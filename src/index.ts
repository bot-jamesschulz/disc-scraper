import puppeteer from "puppeteer-extra";
import { ElementHandle } from 'puppeteer'
import StealthPlugin from "puppeteer-extra-plugin-stealth";
import getSelector from "../utils/getSelector";
import delay from "../utils/delay";
import goToNewTab from "./goToNewTab"
import scrollPage from "./scrollPage";
import getPageListings, { type ListingTitle, ListingData, ListingImgs, ListingPrices } from "./getListingData";
import isNewListings from "./isNewListings";
import waitForStaticPage from "./waitForStaticPage";
import validateListings, { type ValidatedListingTitles } from './validateListings';
import groupListingData, { type Listing } from "./groupListingData";
import { element2selector } from 'puppeteer-element2selector';
import "dotenv/config";
import { GoogleGenerativeAI } from "@google/generative-ai";
import { paginationListings } from "./iterationMethods";
import fs from 'fs';

export type ValidatedListing = {
  listings: ValidatedListingTitles,
  prices: ListingPrices,
  imgs: ListingImgs
}

puppeteer.use(StealthPlugin());
if (!process.env.GEMINI_API_KEY) {
  console.error("Gemini API key is missing or empty. Exiting.");
  process.exit(1);
}
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
let prompt =
  "Return only the input element which is most likely to be a search input for the website's inventory. Do not return any other text or information: ";

async function scrape() {
  const browser = await puppeteer.launch({ headless: false });
  const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });
  const listingData: ListingData[] = [];
  const manufacturer = "Innova";
  const discStore = "https://discgolfunited.com/?utm_source=trydiscs";
  
  const page = await browser.newPage();
  await goToNewTab(
    discStore, 
    page
  );

  const inputs = await page.$$eval("input", (inputs: HTMLInputElement[]) => {
    return inputs.map((i: HTMLInputElement) => i.outerHTML);
  });

  prompt = prompt + inputs.toString();

  let response = await model.generateContent(prompt);
  let result = response.response.text();
  // const result = `<input class="predictive-search__input" type="text" name="q" autocomplete="off" autocorrect="off" aria-label="Search" placeholder="What are you looking for?">`;
  console.log("result", result);

  const inputSelector = getSelector(result);

  console.log("inputSelector", inputSelector);

  // Exit if there is no selector found
  if (!inputSelector) {
    console.log("No input selector found");
    await browser.close();
    return;
  }


  const inputElement = await page.$(inputSelector);

  // If the element is hidden then try to trigger the search action manually
  if (inputElement?.isHidden()) {
    await page.evaluate((selector, query) => {
      const input = document.querySelector(selector) as HTMLInputElement;
      if (input) {
        input.value = query;
        input.closest('form')?.submit();
      }
    }, inputSelector, manufacturer);
  } else {
    await inputElement?.type(manufacturer);
    await inputElement?.press("Enter");
  }
  
  await waitForStaticPage(page);
  
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
  // // const jsonString = fs.readFileSync('./testData.json', 'utf-8');
  // // const discs = JSON.parse(jsonString);
  
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
  // console.log(listings);
  
   // Convert the processed data back to JSON
   const newData = JSON.stringify(listings, null, 2);
    
   // Write the processed data to discs.json
   fs.writeFile('./results/results.json', newData, () => {});

  await browser.close();
}
try {
    scrape();
} catch (e) {
    console.log(e)
}
