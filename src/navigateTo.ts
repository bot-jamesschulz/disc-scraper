import waitForStaticPage from './waitForStaticPage';
import { Page } from "puppeteer";

export default async function navigateTo(url: string, page: Page) {
    try {
        await page.setRequestInterception(true);
        
        const blankImage = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAHzwGA78JN5wAAAABJRU5ErkJggg==';
        page.on('request', (request) => {
            if (request.isInterceptResolutionHandled()) return;
            if (request.resourceType() === "image") {
                request.respond({
                status: 200,
                contentType: 'image/png',
                body: Buffer.from(blankImage, 'base64')
                });  
            } else {
                request.continue();
            }
        });
        page.on('console', msg => {
            if (msg.text().includes('111'))
                console.log('PAGE LOG:', msg.text())
        });

        await page.goto(url,{ waitUntil: 'load'});
        await waitForStaticPage(page);

        return page;
    } catch(err) {
        console.log("Error going to new tab:", err);
        return null;
    }
}
