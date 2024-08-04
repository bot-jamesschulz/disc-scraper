import delay from "../utils/delay";
import { Page } from "puppeteer";

export type ListingTitle = {
  listingIndex: number;
  innerText: string;
  href: string | null;
};

export type ListingImgs = {
  [key: string]: string;
};

export type ListingPrices = (string | null) [];

export type ListingData = {
    listings: ListingTitle[],
    listingImgs: ListingImgs,
    listingPrices: ListingPrices
};

/**
 * Retrieves the listings of vehicles from a web page.
 *
 * @param {Page} page - The Puppeteer page object.
 * @returns {Object} - An object containing disc listing information.
 */
export default async function getPageData(page: Page): Promise<ListingData | undefined> {
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
    let listingData;
  
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
            ?.trim()
            .replace(/\r?\n|\r|\s+/, " ");
  
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
              href: element.getAttribute("href"),
            });
          }
  
          // Get images
          if (
            element.tagName === "IMG" ||
            (element.tagName === "INPUT" &&
              (element.hasAttribute("src") || element.hasAttribute("srcset")))
          ) {
            const waitInterval = 100; // Time to wait before checking the src attribute again
            const maxWaitTime = 500; // Maximum wait time for checking src
            let elapsedTime = 0;
            let waitCount = 0;
  
            // Wait for src attribute to be set
            const waitForSrc = async () => {
  
              if (element.getAttribute("srcset")) {
                let url;
                url = element.getAttribute("srcset");
                const endOfUrl = url?.indexOf(" ");
                const firstUrl = endOfUrl !== -1 ? url?.substring(0, endOfUrl) : url;
                listingImgs[index] = firstUrl || ''; // Save the img's url with an associated element index, for use later to find closest listing element
                prevImgIndex = index;
  
                return;
              }

              if (element.getAttribute("src")) {
                let url;
                try {
                  const src = element.getAttribute("src");
                  if (src) {
                    url = new URL(src, window.location.href);
                  }
                } catch (err) {}
  
                if (url?.href.startsWith("http")) {
                  listingImgs[index] = url.href; // Save the img's url with an associated element index, for use later to find closest listing element
                  prevImgIndex = index;
                  return;
                }
              }
              
              elapsedTime += waitInterval;
              curImgWait += waitInterval;
              ++waitCount;
              if (
                  elapsedTime < maxWaitTime
                  && curImgWait < maxImgWait
              ) {
                console.log('waiting')
                await new Promise((resolve) => setTimeout(resolve, waitInterval));
                await waitForSrc();
              }
            };
            await waitForSrc();
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
  
        return { listings, listingImgs, listingPrices };
      });
    } catch (err) {
      console.log("error retrieving data/images from the DOM", err);
      return;
    }
  
    return listingData;
  }
  
