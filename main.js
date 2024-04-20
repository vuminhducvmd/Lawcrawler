const puppeteer = require('puppeteer');
const fs = require('fs');
const path = require('path');
const puppeteerExtra = require('puppeteer-extra');
const Stealth = require('puppeteer-extra-plugin-stealth');

puppeteerExtra.use(Stealth());

const originalUrls = 'https://thuvienphapluat.vn/page/tim-van-ban.aspx';
let savedCookies = null;

let username = "_";
let password = "_"

async function loginAndSaveCookies(page) {
    // Login to website
    await page.goto(originalUrls);
    const loginBox = await page.$('#usernameTextBox.txt-account-Home');
    if(loginBox) {
        await page.type('#usernameTextBox.txt-account-Home', username);
        await page.type('#passwordTextBox.txt-password-Home', password);
        await page.click('#loginButton');
        console.log("LOGIN SUCCESSFULLY!!!");
        await page.waitForNavigation();
    }
    else {
        await page.click('#Support_HyperLink4');
        console.log('LOG OUT');
        await new Promise(resolve => setTimeout(resolve, 500));
        
        loginAndSaveCookies(page);
    }
    // Save cookies
    savedCookies = await page.cookies();
    return 1;
}

async function attempWithRetrySync(func, maxAttempts=5, timeout=500, ...args) {
    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
        try {
            const result = await func(...args);
            console.log('Operation successful!');
            return result; // Return the result if operation succeeds
        } catch (error) {
            console.error(`Error during attempt ${attempt}:`, error);
            if (attempt < maxAttempts) {
                console.log('Retrying...');
                // Delay before the next attempt (optional)
                await new Promise(resolve => setTimeout(resolve, timeout)); // Adjust the delay as needed
            } else {
                console.error('Max attempts reached. Unable to complete operation.');
                throw error; // Throw the last error if max attempts reached
            }
        }
    }
}

async function loadSavedCookies(page) {
    if (savedCookies) {
        await page.setCookie(...savedCookies);
    }
    return 1;
}

function getLatestFile(directory) {
    const files = fs.readdirSync(directory);
    const sortedFiles = files.map(file => ({
        name: file,
        time: fs.statSync(path.join(directory, file)).ctime.getTime(),
    })).sort((a, b) => b.time - a.time);
    return sortedFiles.length > 0 ? sortedFiles[0].name : null;
}

async function moveFile(source, destination, maxAttempts = 5, timeout = 500) {
    const latestFileName = getLatestFile(source);
    if (!latestFileName) {
      throw new Error('No files found in source directory');
    }
  
    const sourcePath = path.join(source, latestFileName);
    const destinationPath = path.join(destination, latestFileName);
  
    fs.copyFileSync(sourcePath, destinationPath); // Copy file to destination
    // fs.unlinkSync(sourcePath); // Optionally delete original file
    return destinationPath; // If successful, return the destination path
}


function getFileCount(directory) {
    try {
        const files = fs.readdirSync(directory);
        return files.length;
    } catch (error) {
        console.error('Error reading directory:', error);
        return -1; // Return -1 to indicate an error
    }
}

function removeFilesInDirectory(directory) {
    fs.readdirSync(directory).forEach(file => {
        const filePath = path.join(directory, file);
        try {
            fs.unlinkSync(filePath);
            // console.log(`Removed file: ${filePath}`);
        } catch (error) {
            console.error(`Error removing file: ${filePath}`, error);
        }
    });
}

async function waitForDownloadCompletion(downloadPath, initialFileCount, timeout=500) {
    let downloadCompleted = false;
    let latestFile;
    
    while (!downloadCompleted) {
        const currentFileCount = getFileCount(downloadPath); // Get the current number of files

        if (currentFileCount > initialFileCount) {
            latestFile = getLatestFile(downloadPath); // Get the latest file
            if (!latestFile.endsWith('.crdownload')) {
                console.log('Download likely completed!');
                downloadCompleted = true;
                // console.log('Current file count:', currentFileCount);
                return;
            } else {
                console.log('Download in progress...');
            }
        } else {
            console.log('Download in progress...');
        }
        
        await new Promise(resolve => setTimeout(resolve, timeout));
    }
}

async function processItem(page, item, downloadPath, destinationFolder) {
    try {
        const initial = getFileCount(downloadPath);
        await page.click('#aTabTaiVe');
        await page.click('a[onclick="Doc_DLVN(MemberGA);"]');
        // console.log('Downloaded, initial file count:', initial);

        await waitForDownloadCompletion(downloadPath, initial);

        let finalFilePath = await attempWithRetrySync(moveFile, 5, 500, downloadPath, destinationFolder);
        finalFilePath = finalFilePath.replace(/\\/g, '/');
        console.log(finalFilePath);
        item['path'] = finalFilePath;

        return 1;
    } catch (error) {
        console.error('Error occurred during item processing:', error);
    }
}

function readJsonFileSync(filePath) {
    try {
        const data = fs.readFileSync(filePath, 'utf8');
        return JSON.parse(data);
    } catch (error) {
        console.error('Error reading JSON file:', error);
        throw error; // Rethrow the error to handle it outside this function if needed
    }
}

async function writeJsonToFile(data, filePath) {
    try {
        const jsonData = JSON.stringify(data, null, 2);
        await fs.promises.writeFile(filePath, jsonData);
        console.log('Data has been written to', filePath);
    } catch (error) {
        console.error('Error writing JSON file:', error);
        throw error; // Rethrow the error to handle it outside this function if needed
    }
  }

async function processBatch(page, index, folder) {
    const filename = getFilename(index);
    let data = await attempWithRetrySync(readJsonFileSync, 5, 500, folder+filename);
    for(item of data) {
        console.log(item['url']);
        await loadSavedCookies(page);
        await page.goto(item['url']);

        res = await attempWithRetrySync(processItem, 5, 500, page, item, downloadPath, destinationFolder)
        if(!res) {
            throw new Error("Error while downloading a file");
        }
    }
    await attempWithRetrySync(writeJsonToFile, 5, 500, data, folder+filename);
    
}

function getFilename(index) {
    return `${index.toString().padStart(6, '0')}.json`;
}

const downloadPath = 'C:/Users/Admin/Downloads'; 
const destinationFolder = './data'; 
const rawFolder = './raw_data/';

const loginIntervalMinutes = 15; // Interval in minutes for re-login

(async () => {
    removeFilesInDirectory(destinationFolder);

    const browser = await puppeteerExtra.launch({
        headless: false, // Set to true to run Puppeteer in headless mode
        defaultViewport: null, // Allows the page to have a custom viewport size
        args: ['--start-maximized'], // Maximizes the browser window
    });
    const page = await browser.newPage();

    let loginStartTime = new Date(); // Store the initial login time

    await attempWithRetrySync(loginAndSaveCookies, 5, 500, page); // Initial login
    let cnt = 1; // Number of total login
    let log = await attempWithRetrySync(readJsonFileSync, 5, 500, 'log.json');

    while (log["errors"].length > 0) {
        const error = log["errors"].pop(); 
        console.log(error);
        const newPage = await browser.newPage();
        await attempWithRetrySync(processBatch, 5, 500, newPage, error, rawFolder);
        await newPage.close();

        await attempWithRetrySync(writeJsonToFile, 5, 500, log, 'log.json');

        const currentTime = new Date();
        const elapsedTimeMinutes = (currentTime - loginStartTime) / (1000 * 60); // Calculate elapsed time in minutes
        if (elapsedTimeMinutes > (loginIntervalMinutes * cnt)) {
            console.log(`Logging in again after ${loginIntervalMinutes * cnt} minutes...`);
            cnt += 1; // Increase total number of login
            await attempWithRetrySync(loginAndSaveCookies, 5, 500, page);
        }
    }

    for(let it = log["cur"]; it < log["end"]; it++) {
        try {
            const newPage = await browser.newPage();
            await attempWithRetrySync(processBatch, 5, 500, newPage, it, rawFolder);
            await newPage.close();

            await attempWithRetrySync(writeJsonToFile, 5, 500, log, 'log.json');
        } catch (error) {
            console.error(`Error processing page ${it}:`, error);
            log["errors"].push(it);
        }

        await attempWithRetrySync(writeJsonToFile, 5, 500, log, 'log.json');

        const currentTime = new Date();
        const elapsedTimeMinutes = (currentTime - loginStartTime) / (1000 * 60); // Calculate elapsed time in minutes
        if (elapsedTimeMinutes > (loginIntervalMinutes * cnt)) {
            console.log(`Logging in again after ${loginIntervalMinutes * cnt} minutes...`);
            cnt += 1; // Increase total number of login
            await attempWithRetrySync(loginAndSaveCookies, 5, 500, page);
        }
    }

    await browser.close();
})();

