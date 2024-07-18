import { type ListingData } from "../src/getListingData";
import { type ValidatedListing } from "../src/index"

export type Listing = {
    listing?: string | undefined,
    detailsUrl: string,
    imgSrc: string,
    price: string | null
}

export default function groupListingData(listingData: ValidatedListing): Listing[] | undefined {

    if (!listingData || JSON.stringify(listingData) === '{}') return;
  
    const listingIndices = [...listingData.listings.keys()];
    const listingImgs = listingData.imgs;
    const listingPrices = listingData.prices;

    // console.log('indices', listingIndices)
    // console.log('Imgs', listingImgs)
    // console.log('Prices', listingPrices)
  
    const imgIndices = [...Object.keys(listingImgs)].map(index => Number(index)); // Indices of the images
    
    const groupedListingData: Listing[] = [];
    try { 
        listingIndices.forEach( (listingPosition, index) => {    
         
            const nearestListingPosition = listingIndices[index + 1] ?
                listingIndices[index + 1] :
                listingIndices[index - 1];
            
            const defaultDistance = 250;
            const distanceToNearestListing = listingIndices.length === 1 ? 
                defaultDistance : 
                Math.abs(listingPosition - nearestListingPosition);
    
            // Associate image
            let closestImgIndex = imgIndices[imgIndices.length - 1]; // Default to last img
            let closestImgDistance = Number(closestImgIndex) - listingPosition;
            for (const imgPosition of imgIndices) {
                if (imgPosition > listingPosition) {
                    console.log('listingPos', listingPosition);
                    console.log('chosenImgIndex', closestImgIndex);
                    break;
                }

                const imgDistance = Math.abs(imgPosition - listingPosition);
                if (imgDistance < closestImgDistance) {
                    closestImgDistance = imgDistance;
                    closestImgIndex = imgPosition;
                }
            }
    
            // Associate price
            let closestPricePosition = listingPosition;
            let distanceToPrice = listingPosition - closestPricePosition;
            while (!listingPrices[closestPricePosition] &&
                closestPricePosition < listingPrices.length &&
                distanceToPrice < distanceToNearestListing) {
                distanceToPrice++;
                closestPricePosition++;
            }
    
            const closestImg = listingImgs[Number(closestImgIndex)];
            const closestPrice = listingPrices[closestPricePosition];
    
            const listing = listingData.listings.get(listingPosition);

            if (!listing || !closestPrice) {
                return;
            }
                
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