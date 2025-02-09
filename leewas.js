const fs = require('fs').promises;
const fetch = require('node-fetch');
const Papa = require('papaparse');

// Helper function to get short title
function getShortTitle(title) {
    const match = title.match(/\((.*?)\)/);
    return match ? match[1] : title;
}

async function fetchAndProcessData() {
    try {
        // Fetch BFS data
        const response = await fetch("https://ogd-static.voteinfo-app.ch/v1/ogd/sd-t-17-02-20250209-eidgAbstimmung-o.json");
        const bfsData = await response.json();
        console.log("Data successfully loaded");

        // Save raw data
        await fs.writeFile(
            'voting_data.json',
            JSON.stringify(bfsData, null, 2),
            'utf-8'
        );

        // Process vorlagen
        const vorlagen = bfsData.schweiz.vorlagen.map(vorlage => ({
            id: vorlage.vorlagenId,
            title_de: getShortTitle(vorlage.vorlagenTitel.find(t => t.langKey === 'de').text),
            title_fr: getShortTitle(vorlage.vorlagenTitel.find(t => t.langKey === 'fr').text)
        }));

        // Initialize results array
        let results = [];

        // Process each vorlage
        for (const [i, vorlage] of vorlagen.entries()) {
            const timestamp = Date.now();
            const url = `https://tamedia-abstimmungszentrale-hochrechnung.storage.googleapis.com/${vorlage.id}.csv?${timestamp}`;

            try {
                // Fetch and parse CSV
                const csvResponse = await fetch(url);
                const csvText = await csvResponse.text();
                const leewasData = Papa.parse(csvText, { header: true, dynamicTyping: true });
                
                // Sort by time and get latest row
                const sortedRows = leewasData.data.sort((a, b) => a.Time - b.Time);
                const latestRow = sortedRows[sortedRows.length - 1];

                let percentYes = latestRow.Estimate;
                let resultType = 'trend';

                if (bfsData.schweiz.vorlagen[i].resultat.gebietAusgezaehlt) {
                    percentYes = bfsData.schweiz.vorlagen[i].resultat.jaStimmenInProzent;
                    resultType = 'final';
                }

                results.push({
                    id: vorlage.id,
                    time: latestRow.Time,
                    percent_yes: Number(percentYes.toFixed(2)),
                    percent_no: Number((100 - percentYes).toFixed(2)),
                    lower_bound: latestRow.lower_bound,
                    upper_bound: latestRow.upper_bound,
                    share_counted: latestRow.Share_counted,
                    label: latestRow.label,
                    result: latestRow.result,
                    title_de: vorlage.title_de,
                    title_fr: vorlage.title_fr,
                    type: resultType,
                    standesstimmen: latestRow.Standesstimmen
                });

            } catch (error) {
                results.push({
                    id: vorlage.id,
                    time: timestamp,
                    percent_yes: null,
                    percent_no: null,
                    lower_bound: null,
                    upper_bound: null,
                    share_counted: null,
                    label: null,
                    result: null,
                    title_de: vorlage.title_de,
                    title_fr: vorlage.title_fr,
                    type: 'trend',
                    standesstimmen: null
                });
            }
        }

        // Convert results to CSV
        const csv = Papa.unparse(results);
        await fs.writeFile('leewas_data.csv', csv, 'utf-8');

    } catch (error) {
        console.error('Error:', error);
    }
}

// Run the function
fetchAndProcessData();