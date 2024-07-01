const fs = require('fs').promises;

async function processDiscs() {
  try {
    // Read the contents of discsDefault.json
    const data = await fs.readFile('./data/discsDefault.json', 'utf-8');
    
    // Parse the JSON data
    const discs = JSON.parse(data);
    
    // Perform any operations on discs
    const processedDiscs = discs.data.map(({ link, manufacturer_link, logo, manufacturer_logo, discInfo_id, batch_id, status, retailer, uid, ...discs }) => {

      return discs
    });
    
    // Convert the processed data back to JSON
    const newData = JSON.stringify(processedDiscs, null, 2);
    
    // Write the processed data to discs.json
    await fs.writeFile('./data/discs.json', newData, 'utf-8');
    
    console.log('Successfully processed discs and wrote to discs.json');
  } catch (error) {
    console.error('Error processing discs:', error);
  }
}

processDiscs();