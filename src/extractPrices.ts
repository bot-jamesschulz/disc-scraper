import { type ListingPrices } from '../src/getPageListings';

export type PriceAssociation = {
    price: number,
    associatedListing: string
}

export default function extractPrices(listingInfo:{ listingPosition: number, listing: string }[], listingPrices: ListingPrices): PriceAssociation[] {

    const prices: PriceAssociation[] = [];
    try { 
        listingInfo.forEach( ({ listingPosition, listing }, index) => {    
            
            const nearestListingPosition = listingInfo[index + 1].listingPosition ?
                listingInfo[index + 1].listingPosition :
                listingInfo[index - 1].listingPosition;
            
            const defaultDistance = 250;
            const distanceToNearestListing = listingInfo.length === 1 ? 
                defaultDistance : 
                Math.abs(listingPosition - nearestListingPosition);
    
            // Associate price
            let closestPricePosition = listingPosition;
            let distanceToPrice = listingPosition - closestPricePosition;
            while (!listingPrices[closestPricePosition] &&
                closestPricePosition < listingPrices.length &&
                distanceToPrice < distanceToNearestListing) {
                distanceToPrice++;
                closestPricePosition++;
            }
    
            const closestPrice = Number(listingPrices[closestPricePosition]);

            // Make sure there is an associated price that hasn't already been taken
            if (!closestPrice) return;

            prices.push({
                price: closestPrice,
                associatedListing: listing
            });
  
        });
    } catch (err) {
        console.log('error parsing pricing data', err)
    }
    return prices;
  }