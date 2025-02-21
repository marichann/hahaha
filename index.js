const { exec, spawn } = require("child_process");
const readline = require("readline");
const util = require("util");
const execPromise = util.promisify(exec);
const path = require("path");
const fs = require("fs");
const https = require("https");
const { stdout, stderr } = require("process");

const rl = readline.createInterface({
	input: process.stdin,
	output: process.stdout,
	prompt: ''
});

const intervals = [];

// colors
const colors = {
	reset: "\x1b[0m",
	bright: "\x1b[1m",
	dim: "\x1b[2m",
	underscore: "\x1b[4m",
	blink: "\x1b[5m",
	reverse: "\x1b[7m",
	hidden: "\x1b[8m",

	fg: {
		black: "\x1b[30m",
		red: "\x1b[31m",
		green: "\x1b[32m",
		yellow: "\x1b[33m",
		blue: "\x1b[34m",
		magenta: "\x1b[35m",
		cyan: "\x1b[36m",
		white: "\x1b[37m",
		gray: "\x1b[90m",
		crimson: "\x1b[38m"
	},
	bg: {
		black: "\x1b[40m",
		red: "\x1b[41m",
		green: "\x1b[42m",
		yellow: "\x1b[43m",
		blue: "\x1b[44m",
		magenta: "\x1b[45m",
		cyan: "\x1b[46m",
		white: "\x1b[47m",
		gray: "\x1b[100m",
		crimson: "\x1b[48m"
	}
};

// date et heure
function getTime(timestamp) {
	const date = new Date(timestamp);
	const hours = date.getHours();
	const minutes = date.getMinutes();
	const secondes = date.getSeconds();

	const day = date.getDate();
	const month = date.getMonth() + 1;
	const year = date.getFullYear();

	return {
		hours: hours < 10 ? `0${hours}` : `${hours}`,
		minutes: minutes < 10 ? `0${minutes}` : `${minutes}`,
		secondes: secondes < 10 ? `0${secondes}` : `${secondes}`,
		day: day < 10 ? `0${day}` : `${day}`,
		month: month < 10 ? `0${month}` : `${month}`,
		year: year
	};
}

// console colors infos
function okConsole(text) {
	const now = getTime(Date.now());
	const formated = `${now.hours}:${now.minutes}:${now.secondes}`;
	console.log(`[${colors.fg.green}${formated}${colors.reset}] [${colors.fg.green}+${colors.reset}] ${text}`);
}
function errConsole(text) {
	const now = getTime(Date.now());
	const formated = `${now.hours}:${now.minutes}:${now.secondes}`;
	console.log(`[${colors.fg.red}${formated}${colors.reset}] [${colors.fg.red}-${colors.reset}] ${text}`);
}
function sysConsole(text) {
	const now = getTime(Date.now());
	const formated = `${now.hours}:${now.minutes}:${now.secondes}`;
	console.log(`[${colors.fg.blue}${formated}${colors.reset}] [${colors.fg.blue}|${colors.reset}] ${text}`);
}

// intervalles
function stopInterval(name) {
	const i = intervals.findIndex(i => i.name === name);
	if(i !== -1) {
		clearInterval(intervals[i].interval);
		intervals.splice(i, 1);
	}
}
function stopAllIntervals(){
	intervals.forEach(i => clearInterval(i.interval));
	intervals.length = 0;
}

// loading text
function updateLine(line, text) {
	process.stdout.write('\u001b[s');
	process.stdout.write(`\u001b[${line};0H`);
	readline.clearLine(process.stdout, 1);
	process.stdout.write(text);
	process.stdout.write('\u001b[u');
}
function loading(msg, delay, line) {
	let currentLine = 0;
	let currentIndex = 0;
	const symbolsList = ['/', '-', '\\', '|'];

	const updateInterval = setInterval(() => {
		const now = getTime(Date.now());
		const formated = `${getTime(Date.now()).hours}:${getTime(Date.now()).minutes}:${getTime(Date.now()).secondes}`;

		let messages = [
			`${msg}.`, `${msg}..`, `${msg}...`
		].map(m => `[${colors.fg.blue}${formated}${colors.reset}] [${colors.fg.blue}*${colors.reset}] ${m}`);

		const symbol = symbolsList[currentIndex];
		const finalMessage = messages[currentLine].replace("*", symbol);
		updateLine(line, finalMessage);
		currentLine = (currentLine + 1) % messages.length;
		currentIndex = (currentIndex + 1) % symbolsList.length;
	}, delay);
	return updateInterval;
}

// clear console
function clearLine(x) {
	readline.clearLine(process.stdout, 0);
	readline.cursorTo(process.stdout, 0);

	for (let i = 1; i < x; i++) {
		readline.moveCursor(process.stdout, 0, -1);
		readline.clearLine(process.stdout, 0);
	}
}
function clearConsole() {
	process.stdout.write("\x1Bc");
}

// get cursor console
function getCursor() {
	return new Promise((resolve) => {
		process.stdin.setRawMode(true);
		process.stdin.resume();
		process.stdin.setEncoding('utf8');
		let buffer = '';

		const onData = (data) => {
			buffer += data;
			if (buffer.includes('R')) {
				process.stdin.pause();
				process.stdin.setRawMode(false);
				process.stdin.removeListener('data', onData);
				const match = /\[(\d+);(\d+)R/.exec(buffer);
				if (match) {
					const [, row] = match;
					resolve(parseInt(row, 10));
				}
			}
		};
		process.stdin.on('data', onData);
		process.stdout.write('\u001b[6n');
	});
}

// restart 
async function restart(rl, client) {
	rl.close();
	await client.destroy();
	await client.commands.clear();
	const index = process.argv[1];
	const args = process.argv.slice(2);
	const proc = spawn('node', [index, ...args], {
		stdio: 'inherit'
	});
	proc.on('close', (code) => {
		process.exit(code);
	});
}

// get github files
function gitFiles(url) {
	return new Promise((resolve, reject) => {
		https.get(url, (response) => {
			let data = '';
			if (response.statusCode >= 300 && response.statusCode < 400 && response.headers.location) {
				https.get(`${url}/${response.headers.location}`, (res) => {
					if (res.statusCode == 200) {
						res.on("data", (chunck) => data += chunck);
						res.on("end", () => resolve(data));
					} else
						reject(errConsole(`${colors.red}${res.statusCode}${colors.reset}: ${res.statusMessage}`));
				}).on("error", reject);
			} else if (response.statusCode == 200) {
				response.on("data", (chunck) => data += chunck);
				response.on("end", () => resolve(data));
			} else
				reject(errConsole(`${colors.fg.red}${response.statusCode}^${colors.reset}: ${response.statusMessage}`));
		}).on("error", reject);
	})
}

// installation modules
async function chechModules(modules) {
	const errorModules = [];
	for (const m of modules) {
		try {
			require.resolve(m.name);
		} catch (e) {
			errorModules.push(m);
		}
	}
	return errorModules;
}
async function installModules(modules) {
	const errorModules = [];
	for (const m of modules) {
		try {
			await execPromise(`npm install ${m.name}@${m.version} --unsafe-perm`);
		} catch (e) {
			errConsole(`Error module ${colors.fg.red}${m.name}${colors.reset}: ${e}`);
			errorModules.push(m.name);
		}
	}
	return errorModules;
}
async function goModules() {
	const modules = Object.keys(require("./package.json").dependencies).map(m => {
		return {
			name: m,
			version: require("./package.json").dependencies[m]
		}
	});
	const toDownload = await chechModules(modules);
	if(toDownload.length > 0){
		clearLine(1);
		intervals.push({ name: "modules", interval: loading(`Installing: ${colors.fg.red}${toDownload.length}${colors.reset} module${toDownload.length > 1 ? "s" : ""}`, 100, 0)});
		const errorModules = await installModules(toDownload);
		if(errorModules.length > 0)
			errConsole(`Failed to install ${colors.fg.red}${errorModules.length}${colors.reset}/${toDownload.length} module${errorModules.length>1?"s":""}.`);
		else
			okConsole(`Successfully installed ${colors.fg.green}${toDownload.length}${colors.reset}/${toDownload.length} module${toDownload.length>1?"s":""}.`);
		stopInterval("modules");
	} else
		sysConsole(`${modules.length}/${modules.length} modules already installed.`);
}

// installation files

function cleanDir() {
	const files = fs.readdirSync(__dirname);
	for (const f of files) {
		if (f !== '.git') {
			const fPath = path.join(__dirname, f);
			fs.rmSync(fPath, { recursive: true, force: true });
		}
	}
}

async function checkUpdate() {
	const local = await execPromise('git rev-parse HEAD');
	const remote = await execPromise('git rev-parse origin/main');
	if(local !== remote) {
		intervals.push({ name: "files", interval: loading(`Updating repository`, 100, 0) });
		try {
			await execPromise('git reset --hard');
			await execPromise('git pull origin main');
		} catch (e) {
			errConsole(`Error updating: ${e}`);
		}
	} else {
		sysConsole("Repository is up to date.");
	}
}
async function goFiles() {
	const url = "https://github.com/marichann/hahaha";
	if (fs.existsSync('index.js')) {
		fs.renameSync('index.js', 'index_backup.js');
	}

	if (fs.existsSync('.git')){
		await checkUpdate();
	} else {
		intervals.push({ name: "files", interval: loading(`Cloning git repository`, 100, 0)})
		await cleanDir();
		try {
			await execPromise(`git clone ${url} .`);
		} catch (e) {
			errConsole(`Error cloning: ${e}`);
		}
	}

	if (fs.existsSync('index_backup.js')) {
		fs.renameSync('index_backup.js', 'index.js'); 
	}
}


// starting
async function executeFunctions() {
	await clearConsole();
	await intervals.push({ name: "start", interval: loading('Starting', 100, 0) });
	
	await new Promise(resolve => setTimeout(resolve, 2000));
	stopInterval("start");
	await goFiles();

	await new Promise(resolve => setTimeout(resolve, 2000));
	stopInterval("files");
	await goModules();
	
	
}
executeFunctions();
