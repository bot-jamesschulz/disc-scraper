import puppeteer from "puppeteer-extra";
import { ElementHandle } from 'puppeteer';
import StealthPlugin from "puppeteer-extra-plugin-stealth";
import delay from '../utils/delay';
import getSelector from "../utils/getSelector";
import goToNewTab from "./goToNewTab";
import scrollPage from "./scrollPage";
import getPageListings, { type ListingTitle, ListingData, ListingImgs, ListingPrices } from "./getListingData";
import isNewListings from "../utils/isNewListings";
import waitForStaticPage from "./waitForStaticPage";
import validateListings, { type ValidatedListingTitles } from '../utils/validateListings';
import groupListingData, { type Listing } from "../utils/groupListingData";
import { element2selector } from 'puppeteer-element2selector';
import "dotenv/config";
import { GoogleGenerativeAI } from "@google/generative-ai";
import { paginationListings } from "./iterationMethods";
import fs from 'fs';
import scrollToElement from "./scrollToElement";

const jsonString = fs.readFileSync('./data/retailers.json', 'utf-8');
const retailers = JSON.parse(jsonString);

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
  "Identify which element is most likely to be a search input for the website's inventory, and return it. Do not return anything else.";

async function scrape() {
  const browser = await puppeteer.launch({ headless: false });
  const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });
  const listingData: ListingData[] = [];
  const manufacturer = "Discraft";
  const discStore = retailers[26];
  // const discStore = 'https://chumbadiscs.com/search?type=product%2Carticle%2Cpage&options%5Bprefix%5D=last&q=Discraft';
  
  const page = await browser.newPage();
  await goToNewTab(
    discStore, 
    page
  );
  
  const inputHandles = await page.$$("input");
  const inputProspects = new Map<string, ElementHandle<HTMLInputElement>>();
  for (const handle of inputHandles) {
      const outer = await page.evaluate(el => el.outerHTML.replace(/[\r\n]+/g, ' ').replace(/\s+/g, ' ').trim(), handle) // Clean extra space and returns from element html
      inputProspects.set(`${outer}`, handle);
  };

  prompt = `${prompt} ${[...inputProspects.keys()]}`

  let response = await model.generateContent(prompt);
  const result = response.response.text().trim();

  console.log('input element', result)

  const inputElement = inputProspects.get(result) || null;

  // Exit if there is no selector found
  if (!inputElement) {
    await browser.close();
    throw new Error('No input element found');
  }

  await scrollToElement(page, inputElement);

  console.log('is hidden', await inputElement.isHidden())

  // await inputElement.type(manufacturer);
  
  await page.evaluate(async (input, query) => {
    if (input) {
      input.removeAttribute('disabled');
      input.style.visibility = 'visible';
      let i = 0;
      for (const char of query) {
        const keyDownEvent = new KeyboardEvent('keydown', { key: char, bubbles: true });
        const keyPressEvent = new KeyboardEvent('keypress', { key: char, bubbles: true });
        const inputEvent = new Event('input', { bubbles: true });
        const keyUpEvent = new KeyboardEvent('keyup', { key: char, bubbles: true });

        input.value += char;
        input.dispatchEvent(keyDownEvent);
        input.dispatchEvent(keyPressEvent);
        input.dispatchEvent(inputEvent);
        input.dispatchEvent(keyUpEvent);

        await new Promise(resolve => setTimeout(resolve, 100));
      }

      const enterEvent = new KeyboardEvent('keydown', {
        key: 'Enter',
        code: 'Enter',
        keyCode: 13,
        which: 13,
        bubbles: true
      });
      const keyDownEvent = new KeyboardEvent('keydown', { key: 'Enter', bubbles: true });
      const keyPressEvent = new KeyboardEvent('keypress', { key: 'Enter', bubbles: true });
      const inputEvent = new Event('input', { bubbles: true });
      const keyUpEvent = new KeyboardEvent('keyup', { key: 'Enter', bubbles: true });
      input.dispatchEvent(enterEvent);
      input.dispatchEvent(keyDownEvent);
      input.dispatchEvent(keyPressEvent);
      input.dispatchEvent(inputEvent);
      input.dispatchEvent(keyUpEvent);
     
      // input.value = query;
      console.log('input value', input.value);

      await new Promise(resolve => setTimeout(resolve, 500)); // Somehow this prevents a execution context error
      input.closest('form')?.submit();
    }
  }, inputElement, manufacturer);
  
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
}
try {
    scrape();
} catch (e) {
    console.log(e)
}
