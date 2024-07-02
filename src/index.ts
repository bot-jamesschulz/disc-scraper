import puppeteer from "puppeteer-extra";
import StealthPlugin from "puppeteer-extra-plugin-stealth";
import getInputSelector from "../utils/getInputSelector";
import delay from "../utils/delay";
import goToNewTab from "./goToNewTab"
import scrollPage from "./scrollPage";
import getPageListings, { type ListingTitle, ListingData, ListingImgs, ListingPrices } from "./getPageListings";
import isNewListings from "./isNewListings";
import waitForStaticPage from "./waitForStaticPage";
import validateListings, { type ValidatedListingTitles } from './validateListings';
import groupListingData, { type Listing } from "./groupListingData";
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
    const manufacturer = "MVP"

    const page = await browser.newPage();
    await goToNewTab(
        "https://www.marshallstreetdiscgolf.com/?utm_source=trydiscs", 
        page
    );

    const inputs = await page.$$eval("input", (inputs: HTMLInputElement[]) => {
        return inputs.map((i: HTMLInputElement) => i.outerHTML);
    });

    console.log("inputs", inputs.toString());

    prompt = prompt + inputs.toString();

    // const response = await model.generateContent(prompt);
    // const result = response.response.text();
    const result = `<input type="search" id="woocommerce-product-search-field-0" class="search-field" placeholder="Search products…" value="" name="s">`;
    console.log("result", result);

    const inputSelector = getInputSelector(result);

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

    const listingData: ListingData[] = [];
    let newListingData

    do {
        const pageListings = await getPageListings(page);

        if (pageListings) {
            listingData.push(pageListings);
        }

        await scrollPage(page);
        await waitForStaticPage(page)

        newListingData = await getPageListings(page);
    } while (isNewListings(listingData.map(data => data.listings).flat(), newListingData?.listings))
    
    // const jsonString = fs.readFileSync('./testData.json', 'utf-8');
    // const discs = JSON.parse(jsonString);
    
    const validatedListingPages: ValidatedListing[] = [];
    const listings: Listing[] = []
    try {
        for (const dataPage of listingData) {
        // Validate the anchors per page
          const validationListings = validateListings(dataPage.listings, manufacturer, 'https://www.marshallstreetdiscgolf.com/?utm_source=trydiscs')
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
                listings.push(...groupedListings)
            }
        })
      } 
    console.log(listings)

    await browser.close();
}
try {
    scrape();
} catch (e) {
    console.log(e)
}
