import getPageListings, { 
  type ListingData,
  type ListingPrices,
  type ListingImgs
} from "./getPageListings";
import extractImages from './extractImages';
import waitForStaticPage from "./waitForStaticPage";
import isNewListings from "../utils/isNewListings";
import { paginationListings } from "./iterationMethods";
import validateListings, {
  type ValidatedListings,
  type Listing
} from "../utils/validateListings";
import { type Page } from 'puppeteer';

export type ValidatedListingsPage = {
  listings: ValidatedListings,
  prices: ListingPrices,
  imgs: string[]
}

export default async function extractInventory(page: Page, manufacturer: string, retailer: string): Promise<Listing[]> {
  const validatedHrefs = new Set<string>();
  const listings: Listing[] = [];
  // Keeps track of all the potential listings. This is important to keep track of as well as validated listings
  // Becasue we use this to decide when to stop paginating. We don't want to stop just because one page doesn't have any valid listings.
  const listingData: ListingData[] = [];
  let newListingData;
  let scrollIterations = 0;

  // Get infinite loaded listings
  do {
    scrollIterations++;
    const pageListings = await getPageListings(page);

    if (pageListings) {
      listingData.push(pageListings);
      const validatedListings = await validateListings(page, pageListings, manufacturer, retailer);

      if (validatedListings.length) {
        listings.push(...validatedListings)
        
      }
    }
    
    await waitForStaticPage(page);

    newListingData = await getPageListings(page);
  } while (isNewListings(listingData.map(data => data.listings).flat(), newListingData?.listings));
  
  // If there was infinite scroll then skip checking for pagination
  if (scrollIterations > 1) {
    console.log('Infinite scroll listings. Pagination not attempted');
    return listings;
  }
  
  let validatedListings
  try {
    validatedListings = await paginationListings(page, manufacturer, retailer);
  } catch(e) {
    console.log('Error extracting paginated listings', e)
  }
  if (validatedListings) {
    listings.push(...validatedListings);
  }


  return listings;
}