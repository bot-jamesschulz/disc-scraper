import puppeteer from "puppeteer-extra";
import StealthPlugin from "puppeteer-extra-plugin-stealth";
import navigateTo from "./navigateTo";
import { type ListingData, ListingImgs, ListingPrices } from "./getPageData";
import validateListings, { type ValidatedListingTitles } from '../utils/validateListings';
import dbDeleteListings from '../db/deleteListings';
import dbInsertListings from '../db/insertListings';
import groupListingData, { type Listing } from "../utils/groupListingData";
import "dotenv/config";
import extractInventory from "./extractInventory";
import fs from 'fs';
import searchInventory from "./searchInventory";

const retailersJson = fs.readFileSync('./data/retailers.json', 'utf-8');
const retailers = JSON.parse(retailersJson);
const manufacturersJson = fs.readFileSync('./data/majorManufacturers.json', 'utf-8');
const manufacturers = JSON.parse(manufacturersJson);
// const manufacturers = ['Axiom'];

export type ValidatedListing = {
  listings: ValidatedListingTitles,
  prices: ListingPrices,
  imgs: ListingImgs
}

puppeteer.use(StealthPlugin());

async function scrape() {
  
  let browser;
  let page;
  try {
    for (const retailer of retailers.slice(26,27)) {
      const retailerHostname = new URL(retailer).hostname;
      browser = await puppeteer.launch({ headless: false });
      page = await browser.newPage();
      // Remove old listings
      await dbDeleteListings("discs", retailerHostname);
      try {
        for (const manufacturer of manufacturers) {
          await navigateTo(
            retailer, 
            page
          );

          await searchInventory(page, manufacturer);
          
          const listingData: ListingData[] = await extractInventory(page);

          // Validate listings and group attributes
          const validatedListingPages: ValidatedListing[] = [];
          // Dedupe listings
          const validatedHrefs = new Set<string>();
          try {
            for (const dataPage of listingData) {
            // Validate the anchors per page
              const { validatedListings, uniqueListings } = validateListings(dataPage.listings, manufacturer, retailer, validatedHrefs);
              // Add valid listings with their correlated prices and imgs
              if (validatedListings.size) {
                validatedListingPages.push({
                  listings: validatedListings,
                  prices: dataPage.listingPrices,
                  imgs: dataPage.listingImgs
                })
                uniqueListings.forEach(item => validatedHrefs.add(item));
              }
            }
          } catch (err) {
            console.log('Error validating listings', err);
          }
          
          let listings: Listing[] = [];
          // associate listings with closest img and price
          if (validatedListingPages.length) {
            validatedListingPages.forEach(pageListings =>  {
              const groupedListings = groupListingData(pageListings);
              if (groupedListings) {
                listings.push(...groupedListings);
              }

            });
          }
          
          await dbInsertListings("discs", listings);
          
        }
      } catch(e) {
        console.log(e);
      } finally {
        await browser.close();
      }
    }
  } catch(e) {
    console.log(e)
  } finally {
    await browser?.close();
  }
}
try {
    scrape();
} catch (e) {
    console.log(e)
}
