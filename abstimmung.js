const fs = require('fs').promises;
const fetch = require('node-fetch');

async function fetchVotingData() {
    try {
        const response = await fetch("https://ogd-static.voteinfo-app.ch/v1/ogd/sd-t-17-02-20250209-eidgAbstimmung-o.json");
        
        if (response.ok) {
            const data = await response.json();
            console.log("Data successfully loaded");
            
            // Save raw data
            await fs.writeFile(
                'voting_data.json', 
                JSON.stringify(data, null, 2), 
                'utf-8'
            );
            
            // Process data
            const exportArray = data.schweiz.vorlagen.map(vorlage => ({
                id: vorlage.vorlagenId,
                vorlagenTitel: vorlage.vorlagenTitel,
                kantone: vorlage.kantone
            }));
            
            // Save processed data
            await fs.writeFile(
                'abstimmung_geo_results.json',
                JSON.stringify(exportArray, null, 2),
                'utf-8'
            );
            
            console.log(`Saved abstimmung_geo_results.json with ${exportArray.length} entries`);
        } else {
            console.log(`Failed to fetch data. Status code: ${response.status}`);
        }
    } catch (error) {
        console.error('Error:', error);
    }
}

// Run the function
fetchVotingData();