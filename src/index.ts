import puppeteer from "puppeteer-extra";
import StealthPlugin from "puppeteer-extra-plugin-stealth";
import goToNewTab from "./goToNewTab";
import getPageListings, { type ListingTitle, ListingData, ListingImgs, ListingPrices } from "./getListingData";
import isNewListings from "../utils/isNewListings";
import waitForStaticPage from "./waitForStaticPage";
import validateListings, { type ValidatedListingTitles } from '../utils/validateListings';
import groupListingData, { type Listing } from "../utils/groupListingData";
import "dotenv/config";
import { paginationListings } from "./iterationMethods";
import fs from 'fs';
import searchInventory from "./searchInventory";

const retailersJson = fs.readFileSync('./data/retailers.json', 'utf-8');
const retailers = JSON.parse(retailersJson);
const manufacturersJson = fs.readFileSync('./data/manufacturers.json', 'utf-8');
const manufacturers = JSON.parse(manufacturersJson);

export type ValidatedListing = {
  listings: ValidatedListingTitles,
  prices: ListingPrices,
  imgs: ListingImgs
}

puppeteer.use(StealthPlugin());


async function scrape() {
  const browser = await puppeteer.launch({ headless: false });
  const listingData: ListingData[] = [];
  const manufacturer = manufacturers[15];
  const discStore = retailers[25];
  // const discStore = 'https://chumbadiscs.com/search?type=product%2Carticle%2Cpage&options%5Bprefix%5D=last&q=Discraft';
  try {
    const page = await browser.newPage();
    await goToNewTab(
      discStore, 
      page
    );
    
    await searchInventory(page, manufacturer);
    
    let newListingData;
    let scrollIterations = 0;
    // Get infinite loaded listings
    do {
      scrollIterations++;
      const pageListings = await getPageListings(page);

      if (pageListings) {
          listingData.push(pageListings);
      }
      
      await waitForStaticPage(page);

      newListingData = await getPageListings(page);
    } while (isNewListings(listingData.map(data => data.listings).flat(), newListingData?.listings));
    
    let infiniteScroll = false;
    if (scrollIterations > 1) {
      infiniteScroll = true;
    }
    
    if (!infiniteScroll) {
      let listings;
      try {
        listings = await paginationListings(page);
      } catch(e) {
        console.log('Error extracting paginated listings', e)
      }
      if (listings) {
        listingData.push(...listings);
      }
    }

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
    fs.writeFile('./results/results.json', newData, () => {});

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
