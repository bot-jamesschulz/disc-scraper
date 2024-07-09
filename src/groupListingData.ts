import { type ListingData } from "./getListingData";
import { type ValidatedListing } from "./index"

export type Listing = {
    listing?: string | undefined,
    detailsUrl?: string | undefined,
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
  
    const imgIndices = Object.keys(listingImgs); // Indices of the images
    
    let groupedListingData;
    try { 
        groupedListingData = listingIndices.map( (listingPosition, index) => {    
         
            const nearestListingPosition = listingIndices[index + 1] ?
            listingIndices[index + 1] :
            listingIndices[index - 1];
            
            const defaultDistance = 250;
            const distanceToNearestListing = listingIndices.length === 1 ? 
            defaultDistance : 
            Math.abs(listingPosition - nearestListingPosition);
    
            // Associate image
            let closestImgIndex = imgIndices[imgIndices.length - 1]; // Default to last img
            let i = 0;  
            while (i < imgIndices.length) {
    
            const imgDistance = Math.abs(Number(imgIndices[i]) - listingPosition);
            const nextImgDistance = Math.abs(Number(imgIndices[i + 1]) - listingPosition);
            if (nextImgDistance > imgDistance) {
                closestImgIndex =  imgIndices[i];
                break;
            }
            i++;
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
        
            const groupedListing = {
            ...listing,
            imgSrc: closestImg.startsWith('//') ? `http:${closestImg}` : closestImg,
            price: closestPrice,
            }
            return groupedListing;
  
        });
    } catch (err) {
        console.log('error parsing listing/image data', err)
    }
    return groupedListingData;
  }