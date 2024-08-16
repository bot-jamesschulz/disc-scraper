import delay from "../utils/delay";
import { Page } from "puppeteer";

export type ListingTitle = {
  listingIndex: number,
  position: Position,
  innerText: string,
  href: string;
};
export type Position =  {
  x: number,
  y: number
}
export type ListingImg = {
  src: string,
  topCoord: number,
  position: Position
};

export type ListingPrice = {
  price: string,
  position: Position
};

export type ListingData = {
    listings: ListingTitle[],
    listingPrices: ListingPrice[],
    listingImgs: ListingImg[]
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
        const listings: ListingTitle[] = [];
        const listingImgs: ListingImg[] = [];
        const listingPrices: ListingPrice[] = [];
        const elementNodes = document.querySelectorAll("*");
        const elements = Array.from(elementNodes) as HTMLElement[];
  
        for (const [index, element] of elements.entries()) {
          if (!element) continue;

          let rect = element.getBoundingClientRect();
          let position = {
            x: rect.left + rect.width / 2,
            y: rect.top + rect.height / 2 + window.scrollY,
          }
  
          const trimmedText = element.innerText
            ?.replace(/\r?\n|\r|\s+/g, " ")                       // Replace newlines and consecutive spaces with a single space
            .replace(/[^\w\.\/\s\u2013\u2014\u2212-]/g, '')       // Remove any abnormal characters
            .trim();                                             
  
          let wholeText;
          const children = element.childNodes;
          for (const child of children) {
            if (child.nodeType === Node.TEXT_NODE) {
                wholeText = (child as Text).wholeText;
            }
          } 
          
          // Looking for price
          // Necessary to check for just the $ since sometimes the $ and the price is split into multiple elements
          if (wholeText?.includes("$") && wholeText?.length < maxTextLength) {
            const priceRegex = /\$[\d.]+/;
            let price = trimmedText?.match(priceRegex);
            let currElement = element;

            while (!price && currElement.parentNode) {
              currElement = currElement.parentNode as HTMLElement;
              price = currElement?.innerText?.match(priceRegex);
            }

            const currElementRect = currElement.getBoundingClientRect();
            const currElementPosition = {
              x: currElementRect.left + currElementRect.width / 2,
              y: currElementRect.top + currElementRect.height / 2 + window.scrollY
            }

            const trimmedPrice = price?.[0].replace(/[^\d.]/g, ""); // Remove everything but digits and "."
            
            if (trimmedPrice) {
              listingPrices.push({
                price: trimmedPrice,
                position: currElementPosition,
              });
            }
          }
  
          // Looking for listings
          if (trimmedText && element.tagName === "A") {
            listings.push({
              listingIndex: index,
              position,
              innerText: trimmedText,
              href: element.getAttribute("href") || "",
            });
          }

          if ((element.tagName === 'IMG') 
            || (element.tagName === 'PICTURE') 
            ||  (element.tagName === 'INPUT') 
            && (element.hasAttribute('src') || element.hasAttribute('srcset'))) {
              
              const waitInterval = 100; // Time to wait before checking the src attribute again
              const maxWaitTime = 500; // Maximum wait time for checking src
              let elapsedTime = 0;
              let waitCount = 0;
      
              // Wait for src attribute to be set
              const waitForSrc = async () => {

                // Picture elements
                if (element.querySelector("source")) {
                  // Get computed style of the element
                  const computedStyle = window.getComputedStyle(element);

                  // If display is none we need to get the position of the parent element
                  const displayValue = computedStyle.display;
                  if (displayValue === 'none' || displayValue === 'hidden') {
                    rect = element.parentElement?.getBoundingClientRect() || rect;
                    position = {
                      x: rect.left + rect.width / 2,
                      y: rect.top + rect.height / 2  + window.scrollY
                    }
                  }

                  const source = element.querySelector("source");
                  const srcset = source?.getAttribute("srcset");

                  // Get the median resolution src
                  const sources: {url: string, width: number}[] = [];

                  srcset?.split(',').forEach(src => {
                    const [url, descriptor] = src.trim().split(' ');
                    const width = parseInt(descriptor?.replace('w', ''), 10);
                    
                    if (!url || !width) return;

                    sources.push({ url, width });
                  });

                  // Sort the sources by pixel width
                  sources?.sort((a, b) => a.width - b.width);

                  let medianIndex;
                  if (sources) medianIndex = Math.floor(sources.length / 2);
                  let medianSrc;
                  if (medianIndex) medianSrc = sources?.[medianIndex].url;
                  if (medianSrc) listingImgs.push({ 
                      src: medianSrc,
                      topCoord: rect.top + window.scrollY,
                      position
                  });
                  return;
                }

                if (element.getAttribute("srcset")) {
                  const srcset = element.getAttribute("srcset");

                  // Get the median resolution src
                  const sources: {url: string, width: number}[] = [];

                  srcset?.split(',').forEach(src => {
                    const [url, descriptor] = src.trim().split(' ');
                    const width = parseInt(descriptor?.replace('w', ''), 10);
                    
                    if (!url || !width) return;

                    sources.push({ url, width });
                  });

                  // Sort the sources by pixel width
                  sources?.sort((a, b) => a.width - b.width);

                  let medianIndex;
                  if (sources) medianIndex = Math.floor(sources.length / 2);
                  let medianSrc;
                  if (medianIndex) medianSrc = sources?.[medianIndex].url;
                  if (medianSrc) listingImgs.push({ 
                      src: medianSrc,
                      topCoord: rect.top + window.scrollY,
                      position
                  });
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
                        listingImgs.push({ 
                            src: url.href, 
                            topCoord: rect.top + window.scrollY,
                            position
                        });
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
  
        } 
  
        return { listings, listingPrices, listingImgs, url: window.location.href };
      });
    } catch (err) {
      console.log("error retrieving data/images from the DOM", err);
      return;
    }
  
    return listingData;
  }

  
