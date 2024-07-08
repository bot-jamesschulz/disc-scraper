import puppeteer from "puppeteer-extra";
import { ElementHandle } from 'puppeteer'
import StealthPlugin from "puppeteer-extra-plugin-stealth";
import getSelector from "../utils/getSelector";
import delay from "../utils/delay";
import goToNewTab from "./goToNewTab"
import scrollPage from "./scrollPage";
import getPageListings, { type ListingTitle, ListingData, ListingImgs, ListingPrices } from "./getPageListings";
import isNewListings from "./isNewListings";
import waitForStaticPage from "./waitForStaticPage";
import validateListings, { type ValidatedListingTitles } from './validateListings';
import groupListingData, { type Listing } from "./groupListingData";
import { element2selector } from 'puppeteer-element2selector';
import "dotenv/config";
import { GoogleGenerativeAI } from "@google/generative-ai";
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
  const manufacturer = "MVP";
  const discStore = "https://reloaddiscs.com/search?q=mvp&options%5Bprefix%5D=last";
  

  const page = await browser.newPage();
  await goToNewTab(
    discStore, 
    page
  );

  const inputs = await page.$$eval("input", (inputs: HTMLInputElement[]) => {
    return inputs.map((i: HTMLInputElement) => i.outerHTML);
  });

  console.log("inputs", inputs.toString());

  prompt = prompt + inputs.toString();

  let response = await model.generateContent(prompt);
  let result = response.response.text();
  // const result = `<input type="search" id="woocommerce-product-search-field-0" class="search-field" placeholder="Search products…" value="" name="s">`;
  console.log("result", result);

  const inputSelector = getSelector(result);

  // Exit if there is no selector found
  if (!inputSelector) {
    console.log("No input selector found");
    await browser.close();
    return;
  }

  console.log("inputSelector", inputSelector);

  const inputElement = await page.$(inputSelector);

  console.log(
    "input element",
    await page.evaluate((el) => el?.outerHTML, inputElement)
  );

  await inputElement?.type(manufacturer);
  await inputElement?.press("Enter");
  await waitForStaticPage(page)

  
  let newListingData

  do {
    const pageListings = await getPageListings(page);

    if (pageListings) {
        listingData.push(pageListings);
    }
    await waitForStaticPage(page)
    await scrollPage(page);
  

    newListingData = await getPageListings(page);
  } while (isNewListings(listingData.map(data => data.listings).flat(), newListingData?.listings))
  
  // // const jsonString = fs.readFileSync('./testData.json', 'utf-8');
  // // const discs = JSON.parse(jsonString);
  

  const moreResultsXpath = "::-p-xpath(//button[contains(translate(., 'ABCDEFGHIJKLMNOPQRSTUVWXYZ', 'abcdefghijklmnopqrstuvwxyz'), 'show more')])"
  const moreResults = await page.$(moreResultsXpath)

  console.log(moreResults)
  

  if (moreResults) {

    while (await page.$(moreResultsXpath)) {

      await moreResults.click()
      await waitForStaticPage(page)
      await scrollPage(page);
      const pageListings = await getPageListings(page);

      const newListings = isNewListings(listingData.map(data => data.listings).flat(), pageListings?.listings)
      if (pageListings && newListings) {
        listingData.push(pageListings);
      } else {
        break
      }
    } 
  }


  const buttonAnchorMap = new Map<string, string>();
  const buttonAndAnchorHandles = await page.$$('button, a');
  const outerHandles = await Promise.all(buttonAndAnchorHandles.map(async handle => (await page.evaluate(el => el.outerHTML, handle))));
  const buttonAndAnchorSelectors = outerHandles.map(outerHtml => getSelector(outerHtml));
  const navigationProspects = [];
  for (const handle of buttonAndAnchorHandles) {

    const outer = await page.evaluate(el => el.outerHTML.replace(/[\r\n]+/g, ' ').replace(/\s+/g, ' ').trim(), handle) // Clean extra space and returns from element html
    const selector = await element2selector(handle); // Element handle to css selector

    if (!selector) {
      continue;
    };

    if (outer.toLowerCase().includes('next')) {
      navigationProspects.push(outer);
    };

    buttonAnchorMap.set(`${outer}`, selector);

  };

  console.log('key', `|${[...buttonAnchorMap.keys()].find(key => key.includes('Next'))}|`);


  response = await model.generateContent(`Identify which element is most likely to be the navigation to the next page of inventory. Return the entire element but do not return any other text or information:  ${navigationProspects}`);
  result = response.response.text().trim();

  const nextElemSelector = buttonAnchorMap.get(result);
  if (!nextElemSelector) {
    throw new Error(`No selector found in map for ${result}`);
  };
  

  do {
    const pageListings = await getPageListings(page);

    if (pageListings) {
        listingData.push(pageListings);
    }
    const nextElem = await page.$(nextElemSelector);
    await nextElem?.click();
    await scrollPage(page);
    await waitForStaticPage(page)

    newListingData = await getPageListings(page);
  } while (isNewListings(listingData.map(data => data.listings).flat(), newListingData?.listings))



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
  console.log(listings);


  await browser.close();
}
try {
    scrape();
} catch (e) {
    console.log(e)
}
