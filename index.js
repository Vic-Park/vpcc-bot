// Runs the VPCC-Bot

require("dotenv").config();

const fs = require("fs");
const { Client, Intents } = require("discord.js");
const client = new Client({ intents: [ Intents.FLAGS.GUILDS ] });

client.on("ready", () => {
	console.log(`Logged in as ${client.user.tag}`);
});

// key value store (will be upgraded to use replit's built in key value store later)
const store = {
	filename: "store.json",
	async set(key, value) {
		let raw;
		try {
			raw = await fs.promises.readFile(store.filename, "utf-8");
		} catch (e) {
			raw = "";
		}
		const mapping = raw ? JSON.parse(raw) : {};
		if (key.toString() !== "") {
			if (value.toString() === "") {
				mapping[key] = undefined;
			} else {
				try {
					const obj = JSON.parse(value);
					if (JSON.stringify(obj) == value)
						mapping[key] = obj;
					else
						mapping[key] = value;
				} catch (e) {
					mapping[key] = value;
				}
			}
		}
		await fs.promises.writeFile(store.filename, JSON.stringify(mapping));
	},
	async get(key) {
		let raw;
		try {
			raw = await fs.promises.readFile(store.filename, "utf-8");
		} catch (e) {
			raw = "";
		}
		const mapping = raw ? JSON.parse(raw) : {};
		if (key.toString() === "")
			return "";
		if (mapping[key] == null)
			return "";
		if (mapping[key] instanceof String)
			return mapping[key];
		return JSON.stringify(mapping[key]);
	},
};

async function get(store, resource) {
	const raw = await store.get(resource);
	if (raw === "") return {};
	return JSON.parse(raw);
}

async function set(store, resource, data) {
	if (Object.keys(data).length === 0) return await store.set(resource, "");
	return await store.set(resource, JSON.stringify(data));
}

async function modify(store, resource, callback) {
	const data = await get(store, resource);
	await callback(data);
	await set(store, resource, data);
}

function removeFromArray(array, element) {
	const index = array.lastIndexOf(element);
	if (index !== -1)
		array.splice(index, 1);
}

async function findPredicate(array, predicate) {
	for (let i = 0; i < array.length; i++) {
		if (await predicate(array[i], i, array)) {
			return array[i];
		}
	}
	return undefined;
}

client.on("interactionCreate", async interaction => {
	if (!interaction.isCommand())
		return;

	const metadata = {
		timestamp: Date.now(),
		userDisplayName: `${interaction.user.username}#${interaction.user.discriminator}`,
		userId: interaction.user.id,
	};

	if (interaction.commandName === "ping") {
		await interaction.reply("pong");
		return;
	}

	if (interaction.commandName === "profile") {
		const type = interaction.options.getString("type") || "user";
		if (type === "user") {
			console.log([ "profile", "user", metadata ]);
			await interaction.deferReply();
			// find user
			const userIds = (await get(store, "/users")).userIds || [];
			let userId = await findPredicate(userIds, async userId => {
				return interaction.user.id === (await get(store, `/user/${userId}`)).discordUserId;
			});
			// create user if necessary
			if (userId == null) {
				userId = interaction.id;
				await modify(store, `/users`, data => {
					data.userIds = data.userIds || [];
					data.userIds.push(userId);
				});
				await modify(store, `/user/${userId}`, data => {
					data.discordUserId = interaction.user.id;
				});
			}
			// get current team / points / medals
			const userData = await get(store, `/user/${userId}`);
			// get team
			const teamId = userData.teamId;
			const teamName = teamId && (await get(store, `/team/${teamId}`)).name;
			// get points this month
			const pointsThisMonth = [...userData.pointEvents || []].reduce((points, { type, deltaPoints }) => {
				if (type == "add") {
					return points + deltaPoints;
				}
				if (type == "clear") {
					return 0;
				}
			}, 0);
			// get number of medals
			const numMedals = [...userData.medalEvents || []].reduce((numMedals, { type }) => {
				if (type == "add") {
					return numMedals + 1;
				}
			}, 0);
			// build response
			const parts = [];
			parts.push(`Summary for ${metadata.userDisplayName}`);
			if (teamId)
				parts.push(`- Team: ${teamName}`);
			parts.push(`- Points this month: ${pointsThisMonth}`);
			parts.push(`- Medals: ${numMedals}`);
			// send response
			await interaction.editReply({ content: parts.join("\n"), allowedMentions: { parse: [] }});
			return;
		}
		await interaction.reply(`haha lol ${type}`);
		return;
	}

	if (interaction.commandName === "team") {
		const subcommandName = interaction.options.getSubcommand(true);
		if (subcommandName === "create") {
			const name = interaction.options.getString("name", true);
			console.log([ "team", "create", name, metadata ]);
			await interaction.deferReply();
			// find team
			const teamIds = (await get(store, `/teams`)).teamIds || [];
			let otherTeamId = await findPredicate(teamIds, async teamId => {
				return name === (await get(store, `/team/${teamId}`)).name;
			});
			// fail if team exists
			if (otherTeamId != null) {
				await interaction.editReply(`Team called ${name} already exists`);
				return;
			}
			// find user
			const userIds = (await get(store, "/users")).userIds || [];
			let userId = await findPredicate(userIds, async userId => {
				return interaction.user.id === (await get(store, `/user/${userId}`)).discordUserId;
			});
			// fail if user exists and has a previous team
			if (userId != null) {
				let previousTeamId = (await get(store, `/user/${userId}`)).teamId;
				if (previousTeamId != null) {
					await interaction.editReply(`You are still in a team`);
					return;
				}
			}
			// create user if necessary
			if (userId == null) {
				userId = interaction.id;
				await modify(store, `/users`, data => {
					data.userIds = data.userIds || [];
					data.userIds.push(userId);
				});
				await modify(store, `/user/${userId}`, data => {
					data.discordUserId = interaction.user.id;
				});
			}
			// create team
			const teamId = interaction.id;
			await modify(store, `/teams`, data => {
				data.teamIds = data.teamIds || [];
				data.teamIds.push(teamId);
			});
			await modify(store, `/team/${teamId}`, data => {
				data.name = name;
			});
			// join team
			await modify(store, `/team/${teamId}`, data => {
				data.memberIds = data.memberIds || [];
				data.memberIds.push(userId);
			});
			await modify(store, `/user/${userId}`, data => {
				data.teamId = teamId;
			});
			// create role if necessary
			let teamDiscordRoleId = (await get(store, `/team/${teamId}`)).discordRoleId;
			if (teamDiscordRoleId == null) {
				const role = await interaction.guild.roles.create({ name: `Team ${name}` })
				teamDiscordRoleId = role.id
				await modify(store, `/team/${teamId}`, data => {
					data.discordRoleId = role.id;
				});
			}
			// join role
			const discordMember = await interaction.guild.members.fetch(interaction.user.id);
			await discordMember.roles.add(teamDiscordRoleId);
			// reply to interaction
			await interaction.editReply(`Created and joined new team called ${name}`);
			return;
		}
		if (subcommandName === "join") {
			const name = interaction.options.getString("name", true);
			console.log([ "team", "join", name, metadata ]);
			// defer reply cuz it might take a while maybe
			await interaction.deferReply();
			// find user
			const userIds = (await get(store, "/users")).userIds || [];
			let targetUserId = await findPredicate(userIds, async userId => {
				return interaction.user.id === (await get(store, `/user/${userId}`)).discordUserId;
			});
			// leave previous team if exists and has one
			if (targetUserId != null) {
				let previousTeamId = (await get(store, `/user/${targetUserId}`)).teamId;
				if (previousTeamId != null) {
					await modify(store, `/team/${previousTeamId}`, data => {
						data.memberIds = data.memberIds || [];
						removeFromArray(data.memberIds, targetUserId);
					});
					await modify(store, `/user/${targetUserId}`, data => {
						data.teamId = undefined;
					});
					// leave role
					const previousTeamDiscordRoleId = (await get(store, `/team/${previousTeamId}`)).discordRoleId;
					if (previousTeamDiscordRoleId != null) {
						const discordMember = await interaction.guild.members.fetch(interaction.user.id);
						await discordMember.roles.remove(previousTeamDiscordRoleId);
					}
					// remove team if empty
					const previousTeamMemberIds = (await get(store, `/team/${previousTeamId}`)).memberIds || [];
					if (previousTeamDiscordRoleId != null && previousTeamMemberIds.length === 0) {
						await (await interaction.guild.roles.fetch(previousTeamDiscordRoleId)).delete();
						await modify(store, `/teams`, data => {
							data.teamIds = data.teamIds || [];
							removeFromArray(data.teamIds, previousTeamId);
						});
						await set(store, `/team/${previousTeamId}`, {});
					}
				}
			}
			// create user if necessary
			if (targetUserId == null) {
				targetUserId = interaction.id;
				await modify(store, `/users`, data => {
					data.userIds = data.userIds || [];
					data.userIds.push(targetUserId);
				});
				await modify(store, `/user/${targetUserId}`, data => {
					data.discordUserId = interaction.user.id;
				});
			}
			// find team
			const teamIds = (await get(store, "/teams")).teamIds || [];
			let targetTeamId = await findPredicate(teamIds, async teamId => {
				return name === (await get(store, `/team/${teamId}`)).name;
			});
			// create team if necessary
			let createdNewTeam = false;
			if (targetTeamId == null) {
				createdNewTeam = true;
				targetTeamId = interaction.id;
				await modify(store, `/teams`, data => {
					data.teamIds = data.teamIds || [];
					data.teamIds.push(targetTeamId);
				});
				await modify(store, `/team/${targetTeamId}`, data => {
					data.name = name;
				});
			}
			// join team
			await modify(store, `/team/${targetTeamId}`, data => {
				data.memberIds = data.memberIds || [];
				data.memberIds.push(targetUserId);
			});
			await modify(store, `/user/${targetUserId}`, data => {
				data.teamId = targetTeamId;
			});
			// create role if necessary
			let targetTeamDiscordRoleId = (await get(store, `/team/${targetTeamId}`)).discordRoleId;
			if (targetTeamDiscordRoleId == null) {
				const role = await interaction.guild.roles.create({ name: `Team ${name}` })
				targetTeamDiscordRoleId = role.id
				await modify(store, `/team/${targetTeamId}`, data => {
					data.discordRoleId = role.id;
				});
			}
			// join role
			const discordMember = await interaction.guild.members.fetch(interaction.user.id);
			await discordMember.roles.add(targetTeamDiscordRoleId);
			// reply to interaction
			await interaction.editReply(createdNewTeam
				? `Created and joined new team called ${name}`
				: `Joined team called ${name}`
			);
			return;
		}
		if (subcommandName === "leave") {
			console.log([ "team", "leave", metadata ]);
			await interaction.deferReply();
			// get user
			const userIds = (await get(store, `/users`)).userIds || [];
			const userId = await findPredicate(userIds, async userId => {
				return interaction.user.id === (await get(store, `/user/${userId}`)).discordUserId;
			});
			let previousTeamId;
			let teamName;
			// get previous team if user exists
			if (userId != null) {
				previousTeamId = (await get(store, `/user/${userId}`)).teamId;
				// leave previous team if has one
				if (previousTeamId != null) {
					teamName = (await get(store, `/team/${previousTeamId}`)).name;
					await modify(store, `/team/${previousTeamId}`, data => {
						data.memberIds = data.memberIds || [];
						removeFromArray(data.memberIds, userId);
					});
					await modify(store, `/user/${userId}`, data => {
						data.teamId = undefined;
					});
					// leave role
					const previousTeamDiscordRoleId = (await get(store, `/team/${previousTeamId}`)).discordRoleId;
					if (previousTeamDiscordRoleId != null) {
						const discordMember = await interaction.guild.members.fetch(interaction.user.id);
						await discordMember.roles.remove(previousTeamDiscordRoleId);
					}
					// remove role if empty
					const previousTeamMemberIds = (await get(store, `/team/${previousTeamId}`)).memberIds;
					if (previousTeamDiscordRoleId != null && previousTeamMemberIds.length === 0) {
						await (await interaction.guild.roles.fetch(previousTeamDiscordRoleId)).delete();
						await modify(store, `/teams`, data => {
							data.teamIds = data.teamIds || [];
							removeFromArray(data.teamIds, previousTeamId);
						});
						await modify(store, `/team/${previousTeamId}`, data => {
							data.discordRoleId = undefined;
						});
					}
				}
			}
			// reply to interaction
			await interaction.editReply((userId == null || previousTeamId == null)
				? `You are not in a team`
				: `Left team called ${teamName}`
			);
			return;
		}
		if (subcommandName === "rename") {
			const name = interaction.options.getString("name", true);
			console.log([ "team", "rename", name, metadata ]);
			await interaction.deferReply();
			// get user
			const userIds = (await get(store, `/users`)).userIds || [];
			const userId = await findPredicate(userIds, async userId => {
				return interaction.user.id === (await get(store, `/user/${userId}`)).discordUserId;
			});
			// get previous team if user exists
			let teamId = undefined;
			if (userId != null) {
				teamId = (await get(store, `/user/${userId}`)).teamId;
				// rename previous team if has one
				if (teamId != null) {
					await modify(store, `/team/${teamId}`, data => {
						data.name = name;
					});
				}
				// rename role if exists
				const teamDiscordRoleId = (await get(store, `/team/${teamId}`)).discordRoleId;
				if (teamDiscordRoleId != null) {
					await (await interaction.guild.roles.fetch(teamDiscordRoleId)).edit({ name: `Team ${name}` })
				}
			}
			// reply to interaction
			await interaction.editReply((userId == null || teamId == null)
				? `You are not in a team`
				: `Renamed team to ${name}`
			);
			return;
		}
	}

	if (interaction.commandName === "leaderboard") {
		const type = interaction.options.getString("type") || "normal";
		await interaction.reply("haha lol leaderboard");
		return;
	}

	if (interaction.commandName === "points") {
		const subcommandName = interaction.options.getSubcommand(true);
		if (subcommandName === "give-team") {
			const name = interaction.options.getString("name", true);
			const points = interaction.options.getInteger("points", true);
			await interaction.reply(`haha lol team join ${name} ${points}`);
			return;
		}
		if (subcommandName === "give-voice") {
			const channel = interaction.options.getString("channel", true);
			const points = interaction.options.getInteger("points", true);
			await interaction.reply(`haha lol team join ${channel} ${points}`);
			return;
		}
	}
});

client.login(process.env.BOT_TOKEN);
