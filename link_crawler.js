const puppeteer = require('puppeteer');
const fs = require('fs');
const path = require('path');

const originalUrls = 'https://thuvienphapluat.vn/page/tim-van-ban.aspx';
const startUrls = [];
const startPages = 1;
const numPages = 20 //16296;
for (let i = startPages; i <= numPages; i++) {
    startUrls.push(originalUrls + "?page=" + i);
}

async function crawlWebsite(url) {
    const browser = await puppeteer.launch();
    const page = await browser.newPage();
    await page.goto(url);

    const links = await page.$$eval('p.nqTitle > a[onclick]', links => links.map(link => link.href));

    const dataToReturn = [];

    for (const link of links) {
        await page.goto(link);
        const title = await page.title();
        console.log(`Title: ${title}`);

        await page.click('#idTabs li a[onclick]');
        await page.waitForSelector('#divThuocTinh > table');
        const tableString = await page.$eval('#divThuocTinh > table', table => table.textContent);

        const numberPattern = /Số hiệu:\s*(.*?)\s*Loại văn bản:/;
        const typePattern = /Loại văn bản:\s*(.*?)\s*Nơi ban hành:/;
        const organizationPattern = /Nơi ban hành:\s*(.*?)\s*Người ký:/;
        const signerPattern = /Người ký:\s*(.*?)\s*Ngày ban hành:/;
        const dateIssuedPattern = /Ngày ban hành:\s*([\d/]+)/;
        const effectiveDatePattern = /Ngày hiệu lực:\s*([^\n]*)/;
        const gazetteDatePattern = /Ngày công báo:\s*(.*?)\s*Số công báo:/;
        const gazetteNumberPattern = /Số công báo:\s*(.*?)\s*Tình trạng:/;
        const statusPattern = /Tình trạng:\s*(.*)/;
        const categoryPattern = /\/van-ban\/([^/]+)\//;

        const numberMatch = tableString.match(numberPattern);
        const typeMatch = tableString.match(typePattern);
        const organizationMatch = tableString.match(organizationPattern);
        const signerMatch = tableString.match(signerPattern);
        const dateIssuedMatch = tableString.match(dateIssuedPattern);
        const effectiveDateMatch = tableString.match(effectiveDatePattern);
        const gazetteDateMatch = tableString.match(gazetteDatePattern);
        const gazetteNumberMatch = tableString.match(gazetteNumberPattern);
        const statusMatch = tableString.match(statusPattern);
        const categoryMatch = link.match(categoryPattern);

        // Check if matches are not null before accessing [1].trim(), otherwise return null
        const number = numberMatch ? numberMatch[1].trim() : null;
        const type = typeMatch ? typeMatch[1].trim() : null;
        const organization = organizationMatch ? organizationMatch[1].trim() : null;
        const signer = signerMatch ? signerMatch[1].trim() : null;
        const dateIssued = dateIssuedMatch ? dateIssuedMatch[1].trim() : null;
        const effectiveDate = effectiveDateMatch ? effectiveDateMatch[1].trim() : null;
        const gazetteDate = gazetteDateMatch ? gazetteDateMatch[1].trim() : null;
        const gazetteNumber = gazetteNumberMatch ? gazetteNumberMatch[1].trim() : null;
        const status = statusMatch ? statusMatch[1].trim() : null;
        const category = categoryMatch ? categoryMatch[1].trim() : null;

        const data = {
            'url': link,
            'Tiêu đề': title,
            'Số hiệu': number,   
            'Loại văn bản': type,
            'Nơi ban hành': organization,
            'Người ký': signer,
            'Ngày ban hành': dateIssued,
            'Ngày hiệu lực': effectiveDate,
            'Ngày công báo': gazetteDate,
            'Số công báo': gazetteNumber,
            'Tình trạng': status,
            'Lĩnh vực': category,
            'path': null,
        };

        dataToReturn.push(data);
    }
    await browser.close();

    return dataToReturn;
}

async function raw_crawler(urls, folder) {
    let cnt = startPages;
    for (const url of urls) {
        console.log(url);
        const filename = folder + `${cnt.toString().padStart(6, '0')}.json`;
        const result = await crawlWebsite(url);
        console.log('JSON files combined successfully!');
        fs.writeFileSync(filename, JSON.stringify(result, null, 2));
        cnt += 1;
    }
}

raw_crawler(startUrls, 'raw_data/');