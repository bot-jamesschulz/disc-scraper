import puppeteer from "puppeteer-extra";
import StealthPlugin from "puppeteer-extra-plugin-stealth";
import navigateTo from "./navigateTo";
import { type ListingData, ListingImgs, ListingPrices } from "./getListingData";
import validateListings, { type ValidatedListingTitles } from '../utils/validateListings';
import groupListingData, { type Listing } from "../utils/groupListingData";
import "dotenv/config";
import extractInventory from "./extractInventory";
import fs from 'fs';
import searchInventory from "./searchInventory";

const retailersJson = fs.readFileSync('./data/retailers.json', 'utf-8');
const retailers = JSON.parse(retailersJson);
const manufacturersJson = fs.readFileSync('./data/majorManufacturers.json', 'utf-8');
const manufacturers = JSON.parse(manufacturersJson);

export type ValidatedListing = {
  listings: ValidatedListingTitles,
  prices: ListingPrices,
  imgs: ListingImgs
}

puppeteer.use(StealthPlugin());

async function scrape() {
  const browser = await puppeteer.launch({ headless: false });

  const discStore = retailers[25];

  const page = await browser.newPage();

  try {
    
    for (const manufacturer of manufacturers) {
      await navigateTo(
        discStore, 
        page
      );

      await searchInventory(page, manufacturer);
      
      const listingData: ListingData[] = await extractInventory(page)

      // Validate listings and group attributes
      const validatedListingPages: ValidatedListing[] = [];
      const listings: Listing[] = []
      try {
        for (const dataPage of listingData) {
        // Validate the anchors per page
          const validationListings = validateListings(dataPage.listings, manufacturer, discStore)
          // Add valid listings with their correlated prices and imgs
          if (validationListings.size) {
            validatedListingPages.push({
              listings: validationListings,
              prices: dataPage.listingPrices,
              imgs: dataPage.listingImgs
            })
          }
        }
      } catch (err) {
        console.log('Error validating listings', err);
      }

        // associate listings with closest img and price
        if (validatedListingPages.length) {

          validatedListingPages.forEach(pageListings =>  {
            const groupedListings = groupListingData(pageListings)

            if (groupedListings) {
              listings.push(...groupedListings);
            }
          })
        }
      
      // Convert the processed data back to JSON
      const newData = JSON.stringify(listings, null, 2);
        
      // Write the processed data to discs.json
      fs.writeFile(`./results/${manufacturer}Results.json`, newData, () => {});
    }

    await browser.close();
    } catch(e) {
      await browser.close();
      console.log(e)
    }
}
try {
    scrape();
} catch (e) {
    console.log(e)
}
