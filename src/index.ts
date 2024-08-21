import puppeteer from "puppeteer-extra";
import { type PageQueryParam } from "./iterationMethods";
import { 
  type Browser,
  type Page 
} from "puppeteer";
import { type Listing } from '../utils/validateListings';
import StealthPlugin from "puppeteer-extra-plugin-stealth";
import chromium from "@sparticuz/chromium";
import navigateTo from "./navigateTo";
import dbDeleteListings from '../db/deleteListings';
import dbInsertListings from '../db/insertListings';
import "dotenv/config";
import extractInventory from "./extractInventory";
import fs from 'fs';
import searchInventory from "./searchInventory";
import generateResponse from "../utils/inference";

const retailersJson = fs.readFileSync('./data/retailers.json', 'utf-8');
const retailers = JSON.parse(retailersJson);
// const retailers = ["https://www.marshallstreetdiscgolf.com/"];
const manufacturersJson = fs.readFileSync('./data/majorManufacturers.json', 'utf-8');
const manufacturers = JSON.parse(manufacturersJson);
// const manufacturers = ["Clash", "Axiom"];

puppeteer.use(StealthPlugin());

async function scrape() {

  console.time()
  let browser: Browser | null = null;
  let page: Page;
  try {
    for (const [ index, retailer ] of retailers.slice(41,42).entries()) {
      const retailerHostname = new URL(retailer).hostname;
      let pageQueryParam: PageQueryParam = { key: null, checked: false };
      let inventoryStartUrl;
      let searchQueryParam;
      browser = await puppeteer.launch({
	      headless: true,
	      args: [ ...chromium.args, "--disable-notifications" ]
      });
      page = await browser.newPage();

      // Remove old listings
      try {
        await dbDeleteListings("discs", retailerHostname);

        // Extract discs per manufacturer
        for (const manufacturer of manufacturers) {

          // Once we know which query param sets the search value, we use that instead of looking for the input box.
          if (searchQueryParam && inventoryStartUrl) {
            inventoryStartUrl.searchParams.set(searchQueryParam, manufacturer.toString())
            await navigateTo(inventoryStartUrl.toString(), page);

          // If we don't know what the query param is yet, then look for the input box, trigger search action, and get the query param.
          } else {
            await navigateTo(
              retailer, 
              page
            );
            await searchInventory(page, manufacturer);
            if (index == 0) {
              // Get url of the start of the inventory after search has been triggered
              const url = page.url();
              inventoryStartUrl = new URL(url);
              const urlParams = inventoryStartUrl.searchParams;
              const result = await generateResponse(`Identify the query param key that is used to set "${manufacturer}". Return only the key if it is present and no other information. The key has to already be present in the given params. Do not create a key. If there is no key present used to set "${manufacturer}", return 'None': ${urlParams}`);
              console.log('search query param:', result);

              // Verify Gemini isn't hallucinating
              const hasParam = urlParams.has(result);
              searchQueryParam = hasParam ? result : undefined;
              }
          }

          const inventoryInfo = await extractInventory(page, manufacturer, retailer, pageQueryParam);
          const listings = inventoryInfo.listings;
          pageQueryParam = inventoryInfo.pageQueryParam;

          // Dedupe listings
          const seen = new Set();
          const dedupedListings: Listing[] = [];
           listings.forEach(l => {
            if (seen.has(l.details_url)) return;
            dedupedListings.push(l);
            seen.add(l.details_url);
          })

          console.log('deduped listings', dedupedListings)

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
    console.timeEnd()
    await browser?.close();
  }
}

try {
    scrape();
} catch (e) {
    console.log(e)
}
