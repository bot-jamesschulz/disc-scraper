import puppeteer from "puppeteer-extra";
import { 
  type Browser,
  type Page 
} from "puppeteer"
import { type Listing } from '../utils/validateListings'
import StealthPlugin from "puppeteer-extra-plugin-stealth";
import chromium from "@sparticuz/chromium";
import navigateTo from "./navigateTo";
import dbDeleteListings from '../db/deleteListings';
import dbInsertListings from '../db/insertListings';
import "dotenv/config";
import extractInventory from "./extractInventory";
import fs from 'fs';
import searchInventory from "./searchInventory";

const retailersJson = fs.readFileSync('./data/retailers.json', 'utf-8');
const retailers = JSON.parse(retailersJson);
// const retailers = ["https://www.marshallstreetdiscgolf.com/"];
const manufacturersJson = fs.readFileSync('./data/majorManufacturers.json', 'utf-8');
// const manufacturers = JSON.parse(manufacturersJson);
const manufacturers = ["Axiom"];

puppeteer.use(StealthPlugin());

async function scrape() {
  
  let browser: Browser | null = null;
  let page: Page
  try {
    for (const retailer of retailers.slice(1,10)) {
      const retailerHostname = new URL(retailer).hostname;
      browser = await puppeteer.launch({
	      headless: false,
	      args: [...chromium.args, "--disable-notifications"]
      });
      page = await browser.newPage();
      // Remove old listings
      try {
        await dbDeleteListings("discs", retailerHostname);
        for (const manufacturer of manufacturers) {
          await navigateTo(
            retailer, 
            page
          );
          await searchInventory(page, manufacturer);
          const listings = await extractInventory(page, manufacturer, retailer);
          const seen = new Set();
          const dedupedListings: Listing[] = [];
           listings.forEach(l => {
            if (seen.has(l.details_url)) return;
            dedupedListings.push(l);
            seen.add(l.details_url);
          })

          await dbInsertListings("discs", dedupedListings);
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
