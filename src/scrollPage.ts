import { Page } from 'puppeteer';

export default async function scrollPage(page: Page) { 
    try {
        await page.evaluate(async () => {
            // Scroll viewport across the entire page to make sure all content is loaded
            await new Promise<void>(async (resolve) => {
                let totalHeight = 0;
                const distance = 200;
                const interval = 100;
                
                const timer = setInterval(() => {     
                    const scrollHeight = document.body.scrollHeight;        
                    window.scrollBy(0, distance);
                    totalHeight += distance;
                    if(totalHeight >= scrollHeight) {
                        clearInterval(timer);
                        resolve();
                    }
                }, interval);
            });
        });
    } catch (err) {
        console.log('error scrolling page: ', err);
    }
}