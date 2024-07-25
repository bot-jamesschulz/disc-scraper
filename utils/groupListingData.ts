import { type ListingData } from "../src/getPageData";
import { type ValidatedListing } from "../src/index"

export type Listing = {
    listing?: string | undefined,
    detailsUrl: string,
    imgSrc: string,
    price: string | null
}

export default function groupListingData(listingData: ValidatedListing): Listing[] | undefined {

    if (!listingData || JSON.stringify(listingData) === '{}') return;
  
    const listingPositions = [...listingData.listings.keys()];
    const listingImgs = listingData.imgs;
    const listingPrices = listingData.prices;

    // console.log('Positions', listingPositions)
    // console.log('Imgs', listingImgs)
    // console.log('Prices', listingPrices)
  
    const imgPositions = [...Object.keys(listingImgs)].map(index => Number(index)); // Positions of the images
    const usedImgs = new Set<number>();
    // console.log('all img positions', imgPositions)
    
    const groupedListingData: Listing[] = [];
    try { 
        listingPositions.forEach( (listingPosition, index) => {    
         
            const nearestListingPosition = listingPositions[index + 1] ?
                listingPositions[index + 1] :
                listingPositions[index - 1];
            
            const defaultDistance = 250;
            const distanceToNearestListing = listingPositions.length === 1 ? 
                defaultDistance : 
                Math.abs(listingPosition - nearestListingPosition);
    
            // Associate image
            let closestImgPosition = imgPositions[0]; // Default to first img
            let closestImgDistance = Math.abs(Number(closestImgPosition) - listingPosition);
            for (const imgPosition of imgPositions) {

                const imgDistance = Math.abs(imgPosition - listingPosition);

                if (imgDistance < closestImgDistance) {
                    closestImgDistance = imgDistance;
                    closestImgPosition = imgPosition;
                }
                // console.log('img distance', imgDistance)
                // console.log('closestImg distance', closestImgDistance)
                // console.log('closestImg position', closestImgPosition)
            }

            // console.log('--listingPos', listingPosition)
            // console.log('--imgPos', closestImgPosition)
            // console.log('--href',listingImgs[Number(closestImgPosition)])
            // console.log('--listing',listingData.listings.get(listingPosition))
    
            // Associate price
            let closestPricePosition = listingPosition;
            let distanceToPrice = listingPosition - closestPricePosition;
            while (!listingPrices[closestPricePosition] &&
                closestPricePosition < listingPrices.length &&
                distanceToPrice < distanceToNearestListing) {
                distanceToPrice++;
                closestPricePosition++;
            }
    
            const closestImg = listingImgs[Number(closestImgPosition)];
            const closestPrice = listingPrices[closestPricePosition];
            const listing = listingData.listings.get(listingPosition);
            // Make sure there is an associated listing, price, and image that hasn't already been taken
            if (!listing 
                || !closestPrice 
                || usedImgs.has(Number(closestImgPosition))
            ) {
                return;
            }

            usedImgs.add(Number(closestImgPosition))
                
            groupedListingData.push({
                ...listing,
                imgSrc: closestImg.startsWith('//') ? `http:${closestImg}` : closestImg,
                price: closestPrice,
            });
  
        });
    } catch (err) {
        console.log('error parsing listing/image data', err)
    }
    return groupedListingData;
  }