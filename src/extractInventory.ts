import getPageListings, { type ListingData } from "./getListingData";
import waitForStaticPage from "./waitForStaticPage";
import isNewListings from "../utils/isNewListings";
import { paginationListings } from "./iterationMethods";
import { type Page } from 'puppeteer';

export default async function extractInventory(page: Page): Promise<ListingData[]> {
    const listingData: ListingData[] = [];
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

    return listingData;
}