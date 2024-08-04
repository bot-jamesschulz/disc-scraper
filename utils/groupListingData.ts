import { type ListingData } from "../src/getPageData";
import { type ValidatedListing } from "../src/index"

export type Listing = {
    listing: string,
    details_url: string,
    img_src: string,
    price: number,
    model: string,
    manufacturer: string,
    retailer: string
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

        const imgBeforeListing = isImgBeforeListing(listingPositions[0], imgPositions);
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

                // Do not look for images past the listing
                if (imgBeforeListing && imgPosition > listingPosition) break; 

                const imgDistance = Math.abs(imgPosition - listingPosition);

                if (imgDistance < closestImgDistance) {
                    closestImgDistance = imgDistance;
                    closestImgPosition = imgPosition;
                }
                // console.log('img distance', imgDistance);
                // console.log('cur pos', imgPosition);
                // console.log('cur img', listingImgs[Number(imgPosition)]);
                // console.log('closestImg distance', closestImgDistance);
                // console.log('closestImg position', closestImgPosition);
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
            const closestPrice = Number(listingPrices[closestPricePosition]);
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
                img_src: closestImg.startsWith('//') ? `http:${closestImg}` : closestImg,
                price: closestPrice,
            });
  
        });
    } catch (err) {
        console.log('error parsing listing/image data', err)
    }
    return groupedListingData;
  }

  // Sometimes the closest image to the listing is actuall the image after the listing that belongs to the proceeding listing. 
  // If we know that there is already an image directly before the first listing than we should stop looking after we get to the listing to avoid finding closer listings after, that belong to the proceeding listing.
  function isImgBeforeListing(listingPosition: number, imgPositions: number[]) {
    const maxImgDistance = 100;
    for (const imgPosition of imgPositions) {
        if (imgPosition > listingPosition) return false;
        if (listingPosition - imgPosition < maxImgDistance) return true;
    }
  }