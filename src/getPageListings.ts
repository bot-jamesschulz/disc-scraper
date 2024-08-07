import delay from "../utils/delay";
import { Page } from "puppeteer";

export type ListingTitle = {
  listingIndex: number;
  innerText: string;
  href: string;
};

export type ListingImgs = {
  [key: string]: string
};

export type ListingPrices = (string | null) [];

export type ListingData = {
    listings: ListingTitle[],
    listingPrices: ListingPrices,
    url: string
};

/**
 * Retrieves the listings of vehicles from a web page.
 *
 * @param {Page} page - The Puppeteer page object.
 * @returns {Object} - An object containing disc listing information.
 */
export default async function getPageListings(page: Page): Promise<ListingData | undefined> {
  const timeout = 10000; // ms

  console.log("getting listings");

  let listingData;

  try {
    listingData = await Promise.race([extractData(page), delay(timeout)]);
  } catch (err) {
    console.log("error waiting for listings", err);
  }

  return listingData || undefined;
}

async function extractData(page: Page): Promise<ListingData | undefined> {
    let listingData: ListingData;
  
    try {
      // Extract the images/listings from the page, keyed by their position in the DOM
      listingData = await page.evaluate(async () => {
        console.log("Page evaluation start");
  
        const maxTextLength = 250;
        let curImgWait = 0;
        const maxImgWait = 5000;
        let prevImgIndex = 0;
        const listings: ListingTitle[] = [];
        const listingImgs: ListingImgs = {};
        const listingPrices: ListingPrices = [];
        const elementNodes = document.querySelectorAll("*");
        const elements = Array.from(elementNodes) as HTMLElement[];
  
        for (const [index, element] of elements.entries()) {
          if (!element) continue;
  
          // Get text content and associated hrefs
          const backgroundImg =
            window.getComputedStyle(element).backgroundImage === "none"
              ? null
              : window.getComputedStyle(element).backgroundImage;
  
          const trimmedText = element.innerText
            ?.replace(/\r?\n|\r|\s+/g, " ")                       // Replace newlines and consecutive spaces with a single space
            .replace(/[^\w\.\/\s\u2013\u2014\u2212-]/g, '')      // Remove any abnormal characters
            .trim();                                             
  
          let wholeText;
          const children = element.childNodes;
          for (const child of children) {
            if (child.nodeType === Node.TEXT_NODE) {
                wholeText = (child as Text).wholeText;
                // if (wholeText.includes('$')) {
                //     console.log('price', wholeText);
                // }
            }
          } 
  
          // Looking for price
          if (wholeText?.includes("$") && wholeText?.length < maxTextLength) {
            
            const priceRegex = /\$[\d.]+/;
  
            let price = trimmedText?.match(priceRegex);

            let currElement = element;
            while (!price && currElement.parentNode) {
              currElement = currElement.parentNode as HTMLElement;
              price = currElement?.innerText?.match(priceRegex);
            }
  
            const trimmedPrice = price?.[0].replace(/[^\d.]/g, ""); // Remove everything but digits and "."
            
            if (trimmedPrice) {
              listingPrices[index] = trimmedPrice;
            }
          }
  
          // Looking for listings
          if (trimmedText && element.tagName === "A") {
            listings.push({
              listingIndex: index,
              innerText: trimmedText,
              href: element.getAttribute("href") || "",
            });
          }
  
          // Make sure that the background-image isn't part of a subsection/gallery of images
          if (backgroundImg) {
            const backgroundImgUrlMatch = backgroundImg.match(/url\("(.+)"\)/); // Extract the url
            const backgroundImgUrl = backgroundImgUrlMatch
              ? backgroundImgUrlMatch[1]
              : null;
            if (!backgroundImgUrl || backgroundImgUrl.includes(".gif")) continue;
            listingImgs[index] = backgroundImgUrl; // Save the img's url with an associated element index, for use later to find closest listing element
            prevImgIndex = index;
          }
        }
  
        return { listings, listingPrices, url: window.location.href };
      });
    } catch (err) {
      console.log("error retrieving data/images from the DOM", err);
      return;
    }
  
    return listingData;
  }
  
