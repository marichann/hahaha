const { exec, spawn } = require("child_process");
const readline = require("readline");
const util = require("util");
const execPromise = util.promisify(exec);
const path = require("path");
const fs = require("fs");
const https = require("https");
const os = require("os");
const { stdout } = require("process");
const version = '1.0.0'

const rl = readline.createInterface({
	input: process.stdin,
	output: process.stdout,
	prompt: ''
});

const intervals = [];

// colors
const filesUser = [
	{
		name: "config.json",
		content: JSON.stringify({
			"prefix": ".",
			"token": "",
			"color": ""
		})
	},
	{
		name: "logs.txt",
		content: ""
	}
]
const colors = {
	reset: "\x1b[0m",
	bright: "\x1b[1m",
	dim: "\x1b[2m",
	underscore: "\x1b[4m",
	blink: "\x1b[5m",
	reverse: "\x1b[7m",
	hidden: "\x1b[8m",

	fg: {
		red: "\x1b[31m",
		green: "\x1b[32m",
		yellow: "\x1b[33m",
		blue: "\x1b[34m",
		magenta: "\x1b[35m",
		cyan: "\x1b[36m",
		gray: "\x1b[90m",
		lightRed: "\x1b[91m",
		lightGreen: "\x1b[92m",
		lightYellow: "\x1b[93m",
		lightBlue: "\x1b[94m",
		lightMagenta: "\x1b[95m",
		lightCyan: "\x1b[96m"
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

function randomColor(){
	const config = require("./config.json");
	const randomColor = Object.values(colors.fg)[Math.floor(Math.random() * Object.values(colors.fg).length)]
	if (Object.keys(colors.fg).map(k => k.toLowerCase()).includes(config.color.toLowerCase()))
		return colors.fg[Object.keys(colors.fg).find(k => k.toLowerCase() === config.color.toLowerCase())];
	else
		return randomColor;
	
}
// console colors infos
function okConsole(text) {
	const now = getTime(Date.now());
	const formated = `${now.hours}:${now.minutes}:${now.secondes}`;
	process.stdout.write(`\n[${colors.fg.green}${formated}${colors.reset}] [${colors.fg.green}+${colors.reset}] ${text}`);
	if(fs.existsSync('./logs.txt'))
		fs.appendFileSync('./logs.txt', `${formated} | ${text}\n`);
}
function errConsole(text) {
	const now = getTime(Date.now());
	const formated = `${now.hours}:${now.minutes}:${now.secondes}`;
	process.stdout.write(`\n[${colors.fg.red}${formated}${colors.reset}] [${colors.fg.red}-${colors.reset}] ${text}`);
	if (fs.existsSync('./logs.txt'))
		fs.appendFileSync('./logs.txt', `${formated} | ${text}\n`);
}
function sysConsole(text) {
	const now = getTime(Date.now());
	const formated = `${now.hours}:${now.minutes}:${now.secondes}`;
	process.stdout.write(`\n[${colors.fg.blue}${formated}${colors.reset}] [${colors.fg.blue}|${colors.reset}] ${text}`);
	if (fs.existsSync('./logs.txt'))
		fs.appendFileSync('./logs.txt', `${formated} | ${text}\n`);
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
		const formated = `${now.hours}:${now.minutes}:${now.secondes}`;

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
async function restart(client) {
	rl.close();
	await client.destroy();
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
			errConsole(`Failed to install ${colors.fg.red}${m.name}${colors.reset}: ${e}`);
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
	} else
		sysConsole(`${modules.length}/${modules.length} modules already installed.`);
}

// installation files
async function checkFiles(files) {
	let downloadfiles = [];
	for (const f of files) {
		let fileHandle;
		try {
			fileHandle = await fs.promises.open("./" + f, 'r');
		} catch (err) {
			downloadfiles.push(f);
		} finally {
			if (fileHandle) {
				await fileHandle.close();
			}
		}
	}
	return downloadfiles;
}
async function readFiles(dir, excludedFiles, excludedDirs) {
	let results = [];

	async function readDir(currentDir) {
		const entries = await fs.promises.readdir(currentDir, { withFileTypes: true });

		for (const entry of entries) {
			const fullPath = path.join(currentDir, entry.name);

			if (entry.isDirectory()) {
				if (!excludedDirs.includes(entry.name)) {
					await readDir(fullPath);
				}
			} else {
				if (!excludedFiles.includes(entry.name)) {
					results.push(fullPath);
				}
			}
		}
	}

	await readDir(dir);
	return results;
}
async function installFiles(files){
	const errorFiles = [];
	for (const f of files) {
		try {
			const dir = path.dirname(f.name);
			if( dir !== '.') {
				await fs.promises.mkdir(dir, { recursive: true })
			}

			await fs.promises.writeFile(f.name, f.content, 'utf8');
		} catch (e) {
			errConsole(`Failed to install ${colors.fg.red}${f.name}${colors.reset}: ${e}`);
			errorFiles.push(f.name);
		}
	}
	return errorFiles;
}
async function goFiles() {
	const toDownload = await checkFiles(filesUser.map(f => f.name));
	if (toDownload.length > 0) {
		clearLine(1);
		intervals.push({name: "files", interval: loading(`Installing: ${colors.fg.red}${toDownload.length}${colors.reset} file${toDownload.length>1?"s":""}`, 100, 0)});
		const filtered = await readFiles("./", ["index.js"], ["node_modules"]);

		const errorFiles = await installFiles(filesUser.filter(f => toDownload.includes(f.name)));
		if (errorFiles.length > 0) {
			errConsole(`Failed to install ${colors.fg.red}${errorFiles.length}${colors.reset}/${toDownload.length} file${errorFiles.length>1?"s":""}.`);
		} else {
			okConsole(`Successfuly installed ${colors.fg.green}${toDownload.length}${colors.reset}/${toDownload.length} file${toDownload.length>1?"s":""}`);
		}
	} else {
		sysConsole(`${filesUser.length}/${filesUser.length} files already installed.`);
	}
}

// installation update
function cleanDir() {
	const files = fs.readdirSync(__dirname);
	for (const f of files) {
		if (f !== '.git') {
			const fPath = path.join(__dirname, f);
			fs.rmSync(fPath, { recursive: true, force: true });
		}
	}
}
async function goUpdates() {
	const url = "https://github.com/marichann/hahaha";
	const gitVersion = JSON.parse(await gitFiles("https://raw.githubusercontent.com/marichann/hahaha/refs/heads/main/version.json"))
	if (!fs.existsSync('.git')) {
		intervals.push({ name: "update", interval: loading(`Cloning git repository`, 100, 0) })
		await cleanDir();
		try {
			await execPromise(`git clone ${url} .`);
		} catch (e) {
			errConsole(`Error cloning: ${e}`);
		}
	} else if (version === gitVersion.version && fs.existsSync('./package.json')) {
		clearLine(1);
		sysConsole("No update.");
	}
	else {
		intervals.push({ name: "update", interval: loading(`Updating files`, 100, 0) });
		try {
			await execPromise('git reset --hard');
			await execPromise('git pull origin main');
		} catch (e) {
			errConsole(`Error updating: ${e}`);
		}
	}
}


// discord
async function discordAuth(email, password, code = null, ticket = null) {
	const fetch = (await import("node-fetch")).default;
	let data = {
		login: email,
		password: password,
		undelete: false,
		captcha_key: null,
		login_source: null,
		gift_code_sku_id: null
	};
	let path = '/api/v9/auth/login';
	if(code) {
		data = {
			code: code,
			ticket: ticket,
			login_source: null,
			gift_code_sku_id: null
		}
		
		path = '/api/v9/auth/mfa/totp';
	}
	const url = `https://discord.com${path}`;
	const headers = {
		'Content-Type': 'application/json',
		"User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/83.0.4103.61 Safari/537.36",
		'x-fingerprint': '715952977180885042.yskHI7mK4iZWhTX7iXlXIcDovRc',
		'x-super-properties': Buffer.from(JSON.stringify({
			os: 'Windows',
			browser: 'Chrome',
			device: '',
			browser_user_agent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/83.0.4103.61 Safari/537.36',
			browser_version: '83.0.4103.61',
			os_version: '10',
			referring_domain: 'discord.com',
			referrer_current: '',
			referring_domain_current: '',
			release_channel: 'stable',
			client_build_number: 60856,
			client_event_source: null
		}), 'utf-8').toString('base64'),
		'cookie': '__cfduid=d638ccef388c4ca5a94c97c547c7f0d9e1598555308; __cfruid=4d17c1a957fba3c0a08c74ea83114af675f7ef19-1598796039;'
	};
	try {
		const response = await fetch(url, {
			method: 'POST',
			headers: headers,
			body: JSON.stringify(data)
		});
		const res = await response.json();
		if (response.ok)
			return res;
		else
			return res.message;
	} catch (e) {
		return e;
	}
}
async function discordConnect() {
	const Discord = require("discord.js-selfbot-v13");
	const client = new Discord.Client();
	clearConsole();
	stopInterval("launch");
	const config = require("./config.json");
	const fetch = (await import("node-fetch")).default;
	const user = await fetch(`https://discord.com/api/v9/users/@me`, {
		method: 'GET',
		headers: {
			"authorization": config.token,
			"Content-Type": "application/json"
		}
	})
	if (!config.token || !user.ok) {
		console.log(
			`	[${colors.fg.magenta}1${colors.reset}] login by token		[${colors.fg.magenta}2${colors.reset}] login by email
			
			`);
		rl.question(`-> `, (res) => {
			if (res === "1") {
				clearConsole();
				rl.question(`token\n-> `, async (r) => {
					const user = await fetch(`https://discord.com/api/v9/users/@me`, {
						method: 'GET',
						headers: {
							"authorization": r,
							"Content-Type": "application/json"
						}
					})
					if(!user.ok)
						discordConnect();
					else {
						config.token = r;
						fs.writeFile('./config.json', JSON.stringify(config, null, 2), (err) => {
							if (err) errConsole(`Error file: ${err}`);
						})
						restart(client);
					}
				})
			} else if (res === "2") {
				clearConsole();
				rl.question(`email\n-> `, email => {
					rl.question(`password\n-> `, async (password) => {
						const response = await discordAuth(email, password);
						if(response.ticket) {
							rl.question(`A2F code\n-> `, async a2f => {
								const ares = await discordAuth(email, password, a2f, response.ticket);
								if(!ares.token)
									discordConnect();
								else {
									config.token = ares.token;
									fs.writeFile('./config.json', JSON.stringify(config, null, 2), (err) => {
										if (err) errConsole(`Error file: ${err}`);
									})
									restart(client);
								}
							})
						} else if (!response.token)
							discordConnect();
						else {
							config.token = response.token;
							fs.writeFile('./config.json', JSON.stringify(config, null, 2), (err) => {
								if (err) errConsole(`Error file: ${err}`);
							})
							restart(client);
						}
					})
				})
			} else {
				discordConnect();
			}
		})
	} else
		client.login(config.token);
	return client;
}


// ascii
async function textToAscii(text, font) {
	const figlet = require("figlet");
	return new Promise((resolve, reject) => {
		figlet.text(
			text,
			{
				font: font,
				horizontalLayout: "default",
				verticalLayout: "default",
				width: 80,
				whitespaceBreak: true,
			},
			(err, data) => {
				if (err) {
					reject(err);
					return;
				}
				resolve(data);
			}
		);
	});
}
function plaform(platform) {
	switch (platform) {
		case 'aix':
			return 'AIX';
		case 'darwin':
			return 'macOS';
		case 'freebsd':
			return 'FreeBSD';
		case 'linux':
			return 'Linux';
		case 'openbsd':
			return 'OpenBSD';
		case 'sunos':
			return 'SunOS';
		case 'win32':
			return 'Windows';
		default:
			return 'Unknown';
	}
}
async function sizedir(dir) {
	let size = 0;
	const files = await fs.promises.readdir(dir);
	for (const file of files) {
		const filePath = path.join(dir, file);
		const stats = await fs.promises.stat(filePath);
		if (stats.isFile()) {
			size += stats.size;
		} else if (stats.isDirectory()) {
			size += await sizedir(filePath);
		}
	}

	return size;
}
async function osInfo(dir) {
	const size = await sizedir(dir);
	const files = await fs.promises.readdir(dir);
	return {
		filesNumber: (files.length),
		dirSize: (size / (1024 ** 2)).toFixed(2),
		osPlatform: plaform(os.platform()),
		totalMemory: `${(os.totalmem() / (1024 ** 3)).toFixed(2)}`,
		freeMemory: `${(os.freemem() / (1024 ** 3)).toFixed(2)}`
	}
}

async function panel(client, options, isColor, menu, length) {
	const fetch = (await import("node-fetch")).default;
	const config = require("./config.json");
	const asciistart = await textToAscii("OHAYO", "bloody");
	const asciisplited = asciistart.split("\n");
	function spaces(x, y) {
		return " ".repeat(Math.round((x - y) / 2));
	}
	const asciifinal = asciisplited.map(a => spaces(100, a.length) + a).join("\n");
	const dir = path.resolve(__dirname, "./");

	const texts = [
		`${client.user.username}${colors.reset}`,
		`${(await osInfo(dir)).dirSize}${colors.reset} MB | ${isColor ? isColor : randomColor()}${(await osInfo(dir)).osPlatform}${colors.reset} | ${isColor ? isColor : randomColor()}${(await osInfo(dir)).freeMemory}${colors.reset}GO/${isColor ? isColor : randomColor()}${(await osInfo(dir)).totalMemory}${colors.reset}GO`,
		`${config.prefix}${colors.reset} | ${isColor ? isColor : randomColor()}${Object.keys(colors.fg).find(k => k.toLowerCase() === config.color.toLowerCase()) ? Object.keys(colors.fg).find(k => k.toLowerCase() === config.color.toLowerCase()) : (!config.color?"RANDOM":"RAINBOW")}${colors.reset}\n`
	]
	clearConsole()
	console.log(`${isColor ? isColor : randomColor()}${asciifinal}${colors.reset}\n`)
	console.log(" ".repeat((100 - 16) / 2) + "* By Mari-chan *\n\n");
	
	const len = texts[1].length-31
	for (t of texts)
		console.log(`${" ".repeat(Math.round(100 - (len+4))/2)}|${isColor ? isColor : randomColor()}+${colors.reset}| ${isColor ? isColor : randomColor()}${t}`);
	console.log(`${" ".repeat((100 - length) / 2) }${menu}\n\n`);
	console.log(" ".repeat((100 - options.length) / 2) + options.replace(/(\d)/g, `${isColor ? isColor : randomColor()}$1${colors.reset}`));
	console.log("▂".repeat(100) + "\n");
}

async function menu(client) {
	const config = require("./config");
	const color = config.color ? null : randomColor()

	const principalOptions = "[1] config    [2] tools    [3] restart    [0] clearLogs";
	const principalPhrase = "Select an option";
	await panel(client, principalOptions, color, `${color ? color : randomColor()}->${colors.reset} ${principalPhrase} ${color ? color : randomColor()}<-${colors.reset}`, principalPhrase.length+6);
	await rl.question(`${color ? color : randomColor()}->${colors.reset} `, async a => {
		switch (a) {
			case '1':
				async function configMenu(){
					const configOptions = "[1] prefix    [2] color    [3] token    [0] back";
					const configPhrase = "Customize the settings";
					await panel(client, configOptions, color, `${color ? color : randomColor()}->${colors.reset} ${configPhrase} ${color ? color : randomColor()}<-${colors.reset}`, configPhrase.length+6);
					await rl.question(`${color ? color : randomColor()}->${colors.reset} `, async b => {
						switch (b) {
							case '1':
								async function prefixMenu(){
									const prefixOptions = "[0] back";
									const prefixPhrase = "Enter a new prefix";
									await panel(client, prefixOptions, color, `${color ? color : randomColor()}->${colors.reset} ${prefixPhrase} ${color ? color : randomColor()}<-${colors.reset}`, prefixPhrase.length+6);
									await rl.question(`${color ?color: randomColor()}-> ${colors.reset}`, async c => {
										if(c === '0')
											configMenu();
										else {
											config.prefix = c;
											fs.writeFile('./config.json', JSON.stringify(config, null, 2), (e) => {
												if (e) errConsole(`Error file: ${e}`);
											})
											menu(client);
										}
									})
								}
								prefixMenu()
								break;
							case '2':
								async function colorMenu(){
									const colorOptions = "[1] colors    [0] back";
									const colorPhrase = "Enter a new color";
									await panel(client, colorOptions, color, `${color ? color:randomColor()}->${colors.reset} ${colorPhrase} ${color?color:randomColor()}<-${colors.reset}`, colorPhrase.length+6);
									await rl.question(`${color?color:randomColor()}-> ${colors.reset}`, async c => {
										if(c === '0')
											configMenu();
										else if (c === '1') {
											await colorMenu();
											await sysConsole(`${Object.keys(colors.fg).map(c => `${color ? color : randomColor()}${c}${colors.reset}`)},${color ? color : randomColor()}random${colors.reset},${color ? color : randomColor()}rainbow${colors.reset}\n${color ? color : randomColor()}->${colors.reset} `);
										} else if (Object.keys(colors.fg).map(k => k.toUpperCase()).includes(c.toUpperCase()) || (c.toUpperCase() === "RAINBOW") || (c.toUpperCase() === "RANDOM")) {
											config.color = c.toUpperCase() === "RANDOM"?"":c;
											fs.writeFile('./config.json', JSON.stringify(config, null, 2), (e) => {
												if (e) errConsole(`Error file ${e}`);
											})
											menu(client);
										} else
											colorMenu();
									})
								}
								colorMenu()
								break;
							case '3':
								config.token = "";
								fs.writeFile('./config.json', JSON.stringify(config, null, 2), (err) => {
									if (err) errConsole(`Error file: ${err}`);
								})
								discordConnect();
								break;
							case '0':
								menu(client);
								break;
							default:
								configMenu();
						}
					})
				}
				configMenu();
				break;
			case '2':
				menu(client);
				break;
			case '3':
				restart(client);
				break;
			default:
				menu(client);
		}
	})
	return color;
}

// discord functions
async function discordConnected(client) {
	const Discord = require("discord.js-selfbot-v13");
	const fetch = (await import("node-fetch")).default;

	client.on('ready', async () => {
		const color = await menu(client);
	})

	
}

// starting
async function executeFunctions() {
	await clearConsole();
	await intervals.push({ name: "start", interval: loading('Starting', 100, 0) });
	
	await new Promise(resolve => setTimeout(resolve, 1000));
	stopInterval("start");
	await goUpdates();

	await new Promise(resolve => setTimeout(resolve, 2000));
	stopInterval("update");
	await goFiles();

	await new Promise(resolve => setTimeout(resolve, 1000));
	stopInterval("files");
	await goModules();

	await new Promise(resolve => setTimeout(resolve, 2000));
	stopInterval("modules");
	clearLine(3);
	await intervals.push(({ name: "launch", interval: loading('Connecting', 100, 0)}));
	const client = await discordConnect();

	await discordConnected(client);
}
executeFunctions();
