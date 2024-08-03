const fs = require('fs').promises;

async function processDiscs() {
  try {
    // Read the contents of discsDefault.json
    const data = await fs.readFile('./data/discs.json', 'utf-8');
    
    // Parse the JSON data
    const discs = JSON.parse(data);

    const processedDiscs = {}
    
    // Perform any operations on discs
    discs.forEach(({ manufacturer, ...disc}) => {
      if (manufacturer in processedDiscs) {
        processedDiscs[manufacturer].push({ ...disc })
      } else {
        processedDiscs[manufacturer] = [{ ...disc }]
      }
    });
    
    // Convert the processed data back to JSON
    const newData = JSON.stringify(processedDiscs, null, 2);
    
    // Write the processed data to discs.json
    await fs.writeFile('./data/discsSorted.json', newData, 'utf-8');
    
    console.log('Successfully processed discs and wrote to discs.json');
  } catch (error) {
    console.error('Error processing discs:', error);
  }
}

async function getManufacturers() {
  try {
    // Read the contents of discsDefault.json
    const data = await fs.readFile('./data/discs.json', 'utf-8');
    const manufacturers = new Set()
    
    // Parse the JSON data
    const discs = JSON.parse(data);
    
    // Perform any operations on discs
    discs.forEach(({ manufacturer }) => {
      manufacturers.add(manufacturer)
    });

    // Convert the processed data back to JSON
    const newData = JSON.stringify([...manufacturers].sort(), null, 2);
    
    // Write the processed data to discs.json
    await fs.writeFile('./data/manufacturers.json', newData, 'utf-8');
    
    console.log('Successfully processed discs and wrote to discs.json');
  } catch (error) {
    console.error('Error processing discs:', error);
  }
}

async function getMajorManufacturerMolds() {
  try {
    // Read the contents of discsDefault.json
    const data = await fs.readFile('./data/discsSorted.json', 'utf-8');
    const majorManufacturersData = await fs.readFile('./data/majorManufacturers.json', 'utf-8');
    const manufacturers = {};
    
    // Parse the JSON data
    const discs = JSON.parse(data);

    const majorManufacturers = new Set(JSON.parse(majorManufacturersData))
    

    
    // Perform any operations on discs
    for (const key in discs) {
      if (majorManufacturers.has(key)) {
        const molds = discs[key].map(mold => mold.name)
        manufacturers[key] = molds;
      }
    }

    // Convert the processed data back to JSON
    const newData = JSON.stringify(manufacturers, null, 2);
    
    // Write the processed data to discs.json
    await fs.writeFile('./data/majorDiscMolds.json', newData, 'utf-8');
    
    console.log('Successfully processed discs and wrote to discs.json');
  } catch (error) {
    console.error('Error processing discs:', error);
  }
}

getMajorManufacturerMolds();