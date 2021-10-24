// Runs the VPCC-Bot

import _assert from "assert";
import { CategoryChannel, Client, Guild, GuildChannel, Intents, Interaction, MessageActionRow, MessageButton, MessageComponentInteraction, MessageOptions, Permissions, Role, TextChannel, VoiceChannel } from "discord.js";
import Keyv from "keyv";
import { KeyvFile } from "keyv-file";
import NodeCache from "node-cache";

require("dotenv").config();

const client = new Client({ intents: [ Intents.FLAGS.GUILDS, Intents.FLAGS.GUILD_MEMBERS ], rejectOnRateLimit: () => true });

client.on("ready", client => {
	console.log(`Logged in as ${client.user.tag}`);
});

function sleep(milliseconds: number) {
	return new Promise(resolve => setTimeout(resolve, milliseconds));
}

function assert<T>(thing: T): asserts thing is NonNullable<T> {
	_assert(thing != null);
}

// keyv-file based store (will be upgraded to use replit's built in key value store later)
class Store {
	keyv: Keyv<Object>;
	constructor(keyv: Keyv<Object>) {
		this.keyv = keyv;
	};
	async get(resource: string): Promise<Object> {
		return (await this.keyv.get(resource)) ?? {};
	};
	async set(resource: string, data: Object): Promise<void> {
		if (JSON.stringify(data) === "{}")
			await this.keyv.delete(resource);
		else
			await this.keyv.set(resource, data);
	};
	async modify(resource: string, callback: (data: Object) => any): Promise<void> {
		const data = await this.get(resource);
		await callback(data);
		await this.set(resource, data);
	};
}
function createStore(keyv: Keyv<Object>): Store {
	return new Store(keyv);
}
const store = createStore(new Keyv({
	store: new KeyvFile({
		filename: "store.json",
	}),
}) as Keyv<Object>);

// Helper function to remove an element from an array
function removeFromArray<T>(array: T[], element: T): typeof array {
	const index = array.lastIndexOf(element);
	if (index !== -1)
		array.splice(index, 1);
	return array;
}

// Asynchronous version of Array.prototype.find
async function findPredicate<T>(array: T[], predicate: (v: T, i: number, a: typeof array) => Promise<boolean>): Promise<T | undefined> {
	for (let i = 0; i < array.length; i++) {
		if (await predicate(array[i], i, array)) {
			return array[i];
		}
	}
	return undefined;
}

// - VPCC specific helper functions

// global cache object
type ResourceFetchOptions = string | { force?: boolean; resource: string; cache?: boolean };
class Resources {
	store: Store;
	cache: NodeCache;
	resourceCache: WeakMap<object, string>;
	constructor(store: Store) {
		this.store = store;
		this.cache = new NodeCache();
		this.resourceCache = new WeakMap();
	};
	// call with a resource string or an object with { resource, force = false, cache = true }
	async fetch(options: ResourceFetchOptions): Promise<Record<string, any>> {
		if (typeof options === "string")
			options = { resource: options };
		let obj: Record<string, any> | null | undefined = undefined;
		if (!(options.force ?? false))
			obj = this.cache.get(options.resource);
		if (obj == null) {
			obj = await this.store.get(options.resource);
			if (options.cache ?? true)
				this.cache.set(options.resource, obj);
		}
		this.resourceCache.set(obj, options.resource);
		return obj;
	};
	// update the resource object to the store
	async push(obj: Record<string, any>) {
		const resource = this.resourceCache.get(obj);
		if (resource == null) return;
		this.cache.del(resource);
		return await this.store.set(resource, obj);
	};
	// invalidate the cache
	async invalidate() {
		this.cache.flushAll();
	};
}
function createResources(store: Store): Resources {
	return new Resources(store);
}
const resources = createResources(store);

// creates a "transaction" that updates all changed values at the end
class Transaction {
	resources: Resources;
	data: Record<string, any>;
	constructor(resources: Resources) {
		this.resources = resources;
		this.data = {};
	};
	// call with a resource string or an object with resources.fetch.options
	async fetch(options: ResourceFetchOptions): Promise<Record<string, any>> {
		if (typeof options === "string")
			options = { resource: options };
		if (this.data[options.resource] != null)
			return this.data[options.resource];
		const obj = await this.resources.fetch(options);
		if (this.data[options.resource] != null)
			return this.data[options.resource];
		return this.data[options.resource] = obj;
	};
	// pushes all changes and clears data
	async commit(): Promise<void> {
		for (const resource in this.data) {
			// future: check if something actually changed before pushing
			await this.resources.push(this.data[resource]);
			delete this.data[resource];
		}
	};
}
function createTransaction(resources: Resources) {
	return new Transaction(resources);
}

let running = false;

// fetchable type
type Fetchable = Transaction | Resources;

// deletes all values from an object
function clearObject(obj: Record<string, any>) {
	for (const name in obj)
		delete obj[name];
}

type TeamsData = {
	teamIds: TeamData["id"][],
}

type UsersData = {
	userIds: UserData["id"][],
}

type TeamData = {
	id: string,
	name: string,
	memberIds: string[],
	discordRoleId: string,
	discordTextChannelId: string,
	discordVoiceChannelId: string,
	freeToJoin?: boolean,
	pointEvents?: Record<string, any>,
	submissionIds?: string[],
}

type UserData = {
	id: string,
	teamId?: string,
	discordUserId: string,
}

// get users info
async function fetchUsers(resources: Fetchable): Promise<UsersData> {
	const users = await resources.fetch(`/users`);
	users.userIds ??= [];
	return users as UsersData;
}

// get teams info
async function fetchTeams(resources: Fetchable): Promise<TeamsData> {
	const teams = await resources.fetch(`/teams`);
	teams.teamIds ??= [];
	return teams as TeamsData;
}

// Typed Object.keys
function* objectKeys<T>(thing: T): Generator<keyof T> {
	for (const name in thing) {
		yield name as keyof T;
	}
}

// find user with matching requirements
async function findUser(resources: Fetchable, requirements: Partial<UserData>) {
	users:
	for (const userId of (await fetchUsers(resources)).userIds) {
		let user = await fetchUser(resources, userId);
		for (const name of objectKeys(requirements))
			if (requirements[name] !== user[name])
				continue users;
		return user;
	}
	return undefined;
}

// find team with matching requirements
async function findTeam(resources: Fetchable, requirements: Partial<TeamData>) {
	teams:
	for (const teamId of (await fetchTeams(resources)).teamIds) {
		let team = await fetchTeam(resources, teamId);
		for (const name of objectKeys(requirements))
			if (requirements[name] !== team[name])
				continue teams;
		return team;
	}
	return undefined;
}

// find user with id
async function fetchUser(resources: Fetchable, userId: string): Promise<UserData> {
	const user = await resources.fetch(`/user/${userId}`);
	user.id ??= userId;
	return user as UserData;
}

// find teamId with id
async function fetchTeam(resources: Fetchable, teamId: string): Promise<TeamData> {
	const team = await resources.fetch(`/team/${teamId}`);
	team.id ??= teamId;
	return team as TeamData;
}

async function createUser(_guild: any, transaction: Fetchable, { id, ...properties }: UserData): Promise<UserData> {
	const users = await fetchUsers(transaction);
	const user = await fetchUser(transaction, id);
	// create user with properties
	Object.assign(user, properties);
	(users.userIds ??= []).push(user.id);
	return user;
}

// Adapted from https://developer.mozilla.org/en-US/docs/web/javascript/reference/global_objects/error#custom_error_types
class InteractionError extends Error {
	constructor(...params: any[]) {
		// Pass remaining arguments (including vendor specific ones) to parent constructor
		super(...params)

		// Maintains proper stack trace for where our error was thrown (only available on V8)
		if (Error.captureStackTrace) {
			Error.captureStackTrace(this, InteractionError)
		}

		this.name = "InteractionError";
	}
}

async function createTeam(guild: Guild, transaction: Fetchable, { id, ...properties }: Pick<TeamData, "id" | "name" | "freeToJoin">): Promise<TeamData> {
	const teams = await fetchTeams(transaction);
	const team = await fetchTeam(transaction, id);
	// create team with properties
	Object.assign(team, properties);
	(teams.teamIds ??= []).push(team.id);
	team.memberIds ??= [];
	// create team role
	const role = await guild.roles.create({ name: `Team ${team.name}` });
	team.discordRoleId = role.id;
	// get supervisor role
	const supervisorRole = (await guild.roles.fetch()).find((role: { name: string; }) => role.name.toLowerCase() === "supervisor")
	// create team text and voice channels
	const teamCategory = (await guild.channels.fetch()).find((channel: GuildChannel) => (
		channel instanceof CategoryChannel
		&& channel.name.toLowerCase() === "team"
	)) as CategoryChannel | undefined;
	if (teamCategory == null) {
		throw Error("team category not found");
	}
	const channelOptions = {
		parent: teamCategory,
		permissionOverwrites: [
			{ id: guild.roles.everyone, deny: [ Permissions.FLAGS.VIEW_CHANNEL ] },
			{ id: role, allow: [ Permissions.FLAGS.VIEW_CHANNEL ] },
		],
	};
	if (supervisorRole != null) {
		channelOptions.permissionOverwrites.push(
			{ id: supervisorRole, allow: [ Permissions.FLAGS.VIEW_CHANNEL ] },
		);
	} else {
		console.log("sus no supervisor role");
	}
	const textChannel = await guild.channels.create(`Team ${team.name}`, channelOptions);
	const voiceChannel = await guild.channels.create(`Team ${team.name}`, { type: "GUILD_VOICE", ...channelOptions });
	team.discordTextChannelId = textChannel.id;
	team.discordVoiceChannelId = voiceChannel.id;
	return team;
}

async function joinTeam(guild: Guild, _transaction: Fetchable, team: TeamData, user: UserData) {
	// join team
	(team.memberIds ??= []).push(user.id);
	user.teamId = team.id;
	// join team role
	const discordMember = await guild.members.fetch(user.discordUserId);
	const role = await guild.roles.fetch(team.discordRoleId);
	assert(role);
	await discordMember.roles.add(role);
}

async function renameTeam(guild: Guild, _transaction: Fetchable, team: TeamData, name: string) {
	// rename team
	team.name = name;
	// rename team channels
	assert(team.discordTextChannelId);
	assert(team.discordVoiceChannelId);
	const textChannel = await guild.channels.fetch(team.discordTextChannelId);
	const voiceChannel = await guild.channels.fetch(team.discordVoiceChannelId);
	assert(textChannel);
	assert(voiceChannel);
	await textChannel.edit({ name: `Team ${name}` });
	await voiceChannel.edit({ name: `Team ${name}` });
	// rename role
	assert(team.discordRoleId);
	const role = await guild.roles.fetch(team.discordRoleId);
	assert(role);
	await role.edit({ name: `Team ${name}` });
}

async function leaveTeam(guild: Guild, transaction: Fetchable, user: UserData) {
	assert(user.teamId);
	const team = await fetchTeam(transaction, user.teamId);
	team.id ??= user.teamId;
	// leave team role
	const discordMember = await guild.members.fetch(user.discordUserId);
	assert(team.discordRoleId);
	const role = await guild.roles.fetch(team.discordRoleId);
	assert(role);
	await discordMember.roles.remove(role);
	// leave team
	removeFromArray((team.memberIds ??= []), user.id);
	user.teamId = undefined;
}

async function destroyTeam(guild: Guild, transaction: Fetchable, team: TeamData) {
	const teams = await fetchTeams(transaction);
	// remove team channels
	assert(team.discordTextChannelId);
	assert(team.discordVoiceChannelId);
	const textChannel = await guild.channels.fetch(team.discordTextChannelId);
	const voiceChannel = await guild.channels.fetch(team.discordVoiceChannelId);
	assert(textChannel);
	assert(voiceChannel);
	await textChannel.delete();
	await voiceChannel.delete();
	// remove team role
	assert(team.discordRoleId);
	const role = await guild.roles.fetch(team.discordRoleId);
	assert(role);
	await role.delete();
	// remove team
	removeFromArray((teams.teamIds ??= []), team.id);
	clearObject(team);
}

async function checkJoinRandom() {
	const guild = await client.guilds.fetch(process.env.GUILD_ID!);
	console.log("running check on joinRandom");
	const transaction = createTransaction(resources);
	// check if joinRandom info is past 30 minutes
	const joinRandomInfo = await transaction.fetch(`/joinRandom`);
	if (joinRandomInfo.start == null || joinRandomInfo.start + 30 * 60_000 > Date.now())
		return;
	console.log("attempting to add user");
	// ensure user still doesnt have a team
	const caller = await fetchUser(transaction, joinRandomInfo.caller);
	let bestTeam = undefined;
	if (caller.teamId == null) {
		// loop through all teams and get a free to join team with the smallest team size
		for (const teamId of (await fetchTeams(transaction)).teamIds ?? []) {
			const team = await fetchTeam(transaction, teamId);
			if (!team.freeToJoin) continue;
			if (team.memberIds.length >= 4) continue;
			if (!bestTeam ? true : team.memberIds.length < bestTeam.memberIds.length) {
				bestTeam = team;
			}
		}
		// if there's no team available, dm the user with sad face
		if (bestTeam == null) {
			(await (await guild.channels.fetch(joinRandomInfo.discordChannelId) as TextChannel).messages.fetch(joinRandomInfo.discordMessageId)).delete();
			removeFromArray((await transaction.fetch(`/interactions`)).interactionIds ?? [], joinRandomInfo.interactionId);
			clearObject(await transaction.fetch(`/interaction/${joinRandomInfo.interactionId}`));
			clearObject(joinRandomInfo);
			await transaction.commit();
			await (await (await guild.members.fetch(caller.discordUserId)).createDM()).send("30 minutes passed but no free to join teams were available :(")
			return;
		}
		// join the team and clear info
		await joinTeam(guild, transaction, bestTeam, caller);
	}
	const channel = await guild.channels.fetch(joinRandomInfo.discordChannelId) as TextChannel;
	(await channel.messages.fetch(joinRandomInfo.discordMessageId)).delete();
	removeFromArray((await transaction.fetch(`/interactions`)).interactionIds ?? [], joinRandomInfo.interactionId);
	clearObject(await transaction.fetch(`/interaction/${joinRandomInfo.interactionId}`));
	clearObject(joinRandomInfo);
	await transaction.commit();
	if (bestTeam != null) {
		await (await (await guild.members.fetch(caller.discordUserId)).createDM()).send(`30 minutes passed so I've put you in team ${bestTeam.name}`);
	}
}

client.once("ready", async () => {
	while (true) {
		await Promise.all([
			checkJoinRandom(),
			sleep(60_000),
		]);
	}
});

function createTeamInvitationOptions(
	teamName: string,
	caller: string,
	waiting: string[],
	accepted: string[],
	declined: string[],
	disabled: boolean = false,
): MessageOptions {
	return {
		content: (
			`${caller} is inviting people to join Team ${teamName}\n`
			+ `Waiting: ${waiting ? waiting.join(", ") : "*empty*"}\n`
			+ `Accepted: ${accepted ? accepted.join(", ") : "*empty*"}\n`
			+ `Declined: ${declined ? declined.join(", ") : "*empty*"}\n`
		),
		components: [
			new MessageActionRow().addComponents(
				new MessageButton()
					.setCustomId("accept")
					.setLabel("Accept")
					.setStyle("SUCCESS")
					.setDisabled(disabled),
				new MessageButton()
					.setCustomId("decline")
					.setLabel("Decline")
					.setStyle("DANGER")
					.setDisabled(disabled),
				new MessageButton()
					.setCustomId("cancel")
					.setLabel("Cancel")
					.setStyle("SECONDARY")
					.setDisabled(disabled),
			),
		],
	};
}

function createTeamJoinRequestOptions(
	teamName: string,
	caller: string,
	waiting: string[],
	approved: string[],
	rejected: string[],
	disabled: boolean = false,
): MessageOptions {
	return {
		content: (
			`${caller} wants to join Team ${teamName} (${Math.floor((waiting.length + approved.length + rejected.length) / 2 + 1)} needed for approval)\n`
			+ `Waiting: ${waiting ? waiting.join(", ") : "*empty*"}\n`
			+ `Approved: ${approved ? approved.join(", ") : "*empty*"}\n`
			+ `Denied: ${rejected ? rejected.join(", ") : "*empty*"}\n`
		),
		components: [
			new MessageActionRow().addComponents(
				new MessageButton()
					.setCustomId("approve")
					.setLabel("Approve")
					.setStyle("SUCCESS")
					.setDisabled(disabled),
				new MessageButton()
					.setCustomId("reject")
					.setLabel("Reject")
					.setStyle("DANGER")
					.setDisabled(disabled),
				new MessageButton()
					.setCustomId("cancel")
					.setLabel("Cancel")
					.setStyle("SECONDARY")
					.setDisabled(disabled),
			),
		],
	};
}

function createTeamRenameRequestOptions(
	teamName: string,
	newTeamName: string,
	caller: string,
	waiting: string[],
	approved: string[],
	rejected: string[],
	disabled: boolean = false,
): MessageOptions {
	return {
		content: (
			`${caller} wants to rename Team ${teamName} to ${newTeamName} (${Math.floor((waiting.length + approved.length + rejected.length) / 2 + 1)} needed for approval)\n`
			+ `Waiting: ${waiting ? waiting.join(", ") : "*empty*"}\n`
			+ `Approved: ${approved ? approved.join(", ") : "*empty*"}\n`
			+ `Denied: ${rejected ? rejected.join(", ") : "*empty*"}\n`
		),
		components: [
			new MessageActionRow().addComponents(
				new MessageButton()
					.setCustomId("approve")
					.setLabel("Approve")
					.setStyle("SUCCESS")
					.setDisabled(disabled),
				new MessageButton()
					.setCustomId("reject")
					.setLabel("Reject")
					.setStyle("DANGER")
					.setDisabled(disabled),
				new MessageButton()
					.setCustomId("cancel")
					.setLabel("Cancel")
					.setStyle("SECONDARY")
					.setDisabled(disabled),
			),
		],
	};
}

// accept: ✅
// deny: ❌
// cancel: 🗑️

/*
const filter = (reaction, user) => reaction.emoji.name === '👍' && user.id === message.author.id;
const reactions = await message.awaitReactions({ filter, max: 1, time: 60_000 });
*/

const ephemeral = true;

// Process button interactions
client.on("interactionCreate", async (interaction: Interaction) => {
	if (!interaction.isButton())
		return;
	try {
		await interaction.deferUpdate();
	} catch (e) {
		console.log(e);
	}
	console.log({
		timestamp: Date.now(),
		userDisplayName: `${interaction.user.username}#${interaction.user.discriminator}`,
		userId: interaction.user.id,
		messageId: interaction.message.id,
		customId: interaction.customId,
	});
	try {
		if (running) return;
		running = true;
		assert(interaction.guild);
		assert(interaction.channel);
		const message = await interaction.channel.messages.fetch((await interaction.fetchReply()).id);
		const transaction = createTransaction(resources);
		if (!((await transaction.fetch(`/interactions`)).interactionIds ?? []).includes(interaction.message.id)) {
			// await interaction.editReply(`Could not find interaction to continue`);
			console.log("unknown interaction");
			return;
		}

		const info = await transaction.fetch(`/interaction/${interaction.message.id}`);
		if (info.type === "teamCreate") {
			// ensure caller
			let callerUser = await findUser(transaction, { discordUserId: interaction.user.id });
			if (callerUser == null) {
				callerUser = await createUser(interaction.guild, transaction, { id: `${interaction.id}${interaction.user.id}`, discordUserId: interaction.user.id });
			}
			async function createTeamInvitationOptionsFromInfo(info: Record<string, any>, disabled: boolean = false): Promise<MessageOptions> {
				return createTeamInvitationOptions(
					info.futureTeamName,
					`<@${(await fetchUser(transaction, info.caller)).discordUserId}>`,
					await Promise.all(info.waiting.map(async (id: string) => `<@${(await fetchUser(resources, id)).discordUserId}>`)),
					await Promise.all(info.accepted.map(async (id: string) => `<@${(await fetchUser(resources, id)).discordUserId}>`)),
					await Promise.all(info.declined.map(async (id: string) => `<@${(await fetchUser(resources, id)).discordUserId}>`)),
					disabled,
				)
			}
			if (interaction.customId === "accept") {
				if (info.caller === callerUser.id) {
					throw new InteractionError(`You cannot accept your own invitation`);
				} else if (info.accepted.includes(callerUser.id)) {
					throw new InteractionError(`You cannot accept this invitation again`);
				} else if (info.declined.includes(callerUser.id)) {
					throw new InteractionError(`You cannot accept this invitation after declining it`);
				} else if (!info.waiting.includes(callerUser.id)) {
					throw new InteractionError(`You weren't invited`);
				}
				// fail if caller is already in a team
				if (callerUser.teamId != null) {
					throw new InteractionError(`You are already on a team`);
				}
				if (info.accepted.length === 0) {
					// fail if another team with same name exists
					if (await findTeam(transaction, { name: info.futureTeamName }) != null) {
						const options = await createTeamInvitationOptionsFromInfo(info, true);
						removeFromArray((await transaction.fetch(`/interactions`)).interactionIds, info.id);
						clearObject(info);
						await transaction.commit();
						await message.edit(options);
						await message.reply(`Team called ${info.futureTeamName} now exists :(`);
						return;
					}
					removeFromArray(info.waiting, callerUser.id);
					info.accepted.push(callerUser.id);
					// create team
					const team = await createTeam(interaction.guild, transaction, {
						id: info.futureTeamId,
						name: info.futureTeamName,
					});
					for (const userId of [info.caller, ...info.accepted]) {
						await joinTeam(interaction.guild, transaction, team, await fetchUser(transaction, userId));
					}
					if (info.waiting.length === 0) {
						const options = await createTeamInvitationOptionsFromInfo(info, true);
						removeFromArray((await transaction.fetch(`/interactions`)).interactionIds, interaction.message.id);
						clearObject(info);
						await transaction.commit();
						await message.edit(options);
						await message.reply(`Team ${team.name} is created`);
						return
					}
					await transaction.commit();
					await message.edit(await createTeamInvitationOptionsFromInfo(info));
					await message.reply(`Team ${team.name} is created`);
					return;
				} else {
					// fail if team is full
					const team = await fetchTeam(transaction, info.futureTeamId)
					if (team.memberIds.length >= 4) {
						throw new InteractionError(`Team ${info.futureTeamName} is now full`);
					}
					removeFromArray(info.waiting, callerUser.id);
					info.accepted.push(callerUser.id);
					await joinTeam(interaction.guild, transaction, team, callerUser);
					if (info.waiting.length === 0) {
						const options = await createTeamInvitationOptionsFromInfo(info, true);
						removeFromArray((await transaction.fetch(`/interactions`)).interactionIds, interaction.message.id);
						clearObject(info);
						await transaction.commit();
						await message.edit(options);
						return
					}
					await transaction.commit();
					await message.edit(await createTeamInvitationOptionsFromInfo(info));
					await interaction.followUp({ ephemeral, content: `Accepted invitation to join team ${team.name}` });
					return;
				}
			}
			if (interaction.customId === "decline") {
				if (info.caller === callerUser.id) {
					throw new InteractionError(`You cannot decline your own invitation`);
				} else if (info.declined.includes(callerUser.id)) {
					throw new InteractionError(`You cannot decline this invitation again`);
				} else if (info.accepted.includes(callerUser.id)) {
					throw new InteractionError(`You cannot decline this invitation after accepting it`);
				} else if (!info.waiting.includes(callerUser.id)) {
					throw new InteractionError(`You weren't invited`);
				}
				removeFromArray(info.waiting, callerUser.id);
				info.declined.push(callerUser.id);
				if (info.waiting.length == 0) {
					const teamName = info.futureTeamName;
					const options = await createTeamInvitationOptionsFromInfo(info, true);
					removeFromArray((await transaction.fetch(`/interactions`)).interactionIds, interaction.message.id);
					clearObject(info);
					await transaction.commit();
					await message.edit(options);
					await message.reply(`Team ${teamName} won't be created`);
					return;
				}
				await transaction.commit();
				await message.edit(await createTeamInvitationOptionsFromInfo(info));
				await interaction.followUp({ ephemeral, content: `Declined invitation to join team ${info.futureTeamName}` });
				return;
			}
			if (interaction.customId === "cancel") {
				if (info.caller !== callerUser.id) {
					throw new InteractionError(`You aren't the inviter`);
				}
				const teamName = info.futureTeamName;
				const options = await createTeamInvitationOptionsFromInfo(info, true);
				removeFromArray((await transaction.fetch(`/interactions`)).interactionIds, interaction.message.id);
				clearObject(info);
				await transaction.commit();
				await message.edit(options);
				await message.reply(`Invitations to team ${teamName} cancelled`);
				return;
			}
		}
		if (info.type === "teamJoin") {
			const team = await fetchTeam(transaction, info.teamId);
			const numMembers = info.waiting.length + info.approved.length + info.rejected.length;
			async function createTeamJoinRequestOptionsFromInfo(info: Record<string, any>, disabled: boolean = false): Promise<MessageOptions> {
				return createTeamJoinRequestOptions(
					team.name,
					`<@${(await fetchUser(transaction, info.caller)).discordUserId}>`,
					await Promise.all(info.waiting.map(async (id: string) => `<@${(await fetchUser(resources, id)).discordUserId}>`)),
					await Promise.all(info.approved.map(async (id: string) => `<@${(await fetchUser(resources, id)).discordUserId}>`)),
					await Promise.all(info.rejected.map(async (id: string) => `<@${(await fetchUser(resources, id)).discordUserId}>`)),
					disabled,
				)
			}
			// ensure caller
			let callerUser = await findUser(transaction, { discordUserId: interaction.user.id });
			if (callerUser == null) {
				callerUser = await createUser(interaction.guild, transaction, { id: `${interaction.id}${interaction.user.id}`, discordUserId: interaction.user.id });
			}
			if (interaction.customId === "approve") {
				if (info.approved.includes(callerUser.id)) {
					throw new InteractionError(`You cannot approve this join request again`);
				} else if (info.rejected.includes(callerUser.id)) {
					throw new InteractionError(`You cannot approve this join request after rejecting it`);
				} else if (!info.waiting.includes(callerUser.id)) {
					throw new InteractionError(`You are not in this team`);
				}
				removeFromArray(info.waiting, callerUser.id);
				info.approved.push(callerUser.id);
				const requester = await fetchUser(transaction, info.caller);
				if (info.approved.length > numMembers / 2) {
					// fail if team is full
					if (team.memberIds.length >= 4) {
						const options = await createTeamJoinRequestOptionsFromInfo(info, true);
						removeFromArray((await transaction.fetch(`/interactions`)).interactionIds, interaction.message.id);
						clearObject(info);
						await transaction.commit();
						await message.edit(options);
						await message.reply(`<@${requester.discordUserId}>'s requested team is now full`);
						return;
					}
					// fail if caller is already in a team
					if (requester.teamId != null) {
						const options = await createTeamJoinRequestOptionsFromInfo(info, true);
						removeFromArray((await transaction.fetch(`/interactions`)).interactionIds, interaction.message.id);
						clearObject(info);
						await transaction.commit();
						await message.edit(options);
						await message.reply(`<@${requester.discordUserId}> now has a team`);
						return;
					}
					await joinTeam(interaction.guild, transaction, team, requester);
					const options = await createTeamJoinRequestOptionsFromInfo(info, true);
					removeFromArray((await transaction.fetch(`/interactions`)).interactionIds, interaction.message.id);
					clearObject(info);
					await transaction.commit();
					await message.edit(options);
					await message.reply(`<@${requester.discordUserId}> joined team ${team.name}`);
					return;
				}
				await transaction.commit();
				await message.edit(await createTeamJoinRequestOptionsFromInfo(info));
				await interaction.followUp({ ephemeral, content: `Approved request from <@${requester.discordUserId}> to join team ${team.name}` });
				return;
			}
			if (interaction.customId === "reject") {
				if (info.rejected.includes(callerUser.id)) {
					throw new InteractionError(`You cannot reject this join request again`);
				} else if (info.approved.includes(callerUser.id)) {
					throw new InteractionError(`You cannot reject this join request after approving it`);
				} else if (!info.waiting.includes(callerUser.id)) {
					throw new InteractionError(`You are not in this team`);
				}
				removeFromArray(info.waiting, callerUser.id);
				info.rejected.push(callerUser.id);
				const callerDiscordUserId = (await fetchUser(transaction, info.caller)).discordUserId;
				if (info.rejected.length >= numMembers / 2) {
					const options = await createTeamJoinRequestOptionsFromInfo(info, true);
					removeFromArray((await transaction.fetch(`/interactions`)).interactionIds, interaction.message.id);
					clearObject(info);
					await transaction.commit();
					await message.edit(options);
					await message.reply(`Rejected <@${callerDiscordUserId}>'s request to join team ${team.name}`);
					return;
				}
				await transaction.commit();
				await message.edit(await createTeamJoinRequestOptionsFromInfo(info));
				await interaction.followUp({ ephemeral, content: `Rejected request from <@${callerDiscordUserId}> to join team ${team.name}` });
				return;
			}
			if (interaction.customId === "cancel") {
				if (info.caller !== callerUser.id) {
					throw new InteractionError(`You can't cancel someone else's request to join`);
				}
				const callerDiscordUserId = (await fetchUser(transaction, info.caller)).discordUserId;
				const options = await createTeamJoinRequestOptionsFromInfo(info, true);
				removeFromArray((await transaction.fetch(`/interactions`)).interactionIds, interaction.message.id);
				clearObject(info);
				await transaction.commit();
				await message.edit(options);
				await message.reply(`<@${callerDiscordUserId}>'s request to join ${team.name} is cancelled`);
				return;
			}
		}
		if (info.type === "teamRename") {
			const team = await fetchTeam(transaction, info.teamId);
			const numMembers = info.waiting.length + info.approved.length + info.rejected.length;
			async function createTeamRenameRequestOptionsFromInfo(info: Record<string, any>, disabled: boolean = false): Promise<MessageOptions> {
				return createTeamRenameRequestOptions(
					team.name,
					info.newTeamName,
					`<@${(await fetchUser(transaction, info.caller)).discordUserId}>`,
					await Promise.all(info.waiting.map(async (id: string) => `<@${(await fetchUser(resources, id)).discordUserId}>`)),
					await Promise.all(info.approved.map(async (id: string) => `<@${(await fetchUser(resources, id)).discordUserId}>`)),
					await Promise.all(info.rejected.map(async (id: string) => `<@${(await fetchUser(resources, id)).discordUserId}>`)),
					disabled,
				)
			}
			// ensure caller
			let callerUser = await findUser(transaction, { discordUserId: interaction.user.id });
			if (callerUser == null) {
				callerUser = await createUser(interaction.guild, transaction, { id: `${interaction.id}${interaction.user.id}`, discordUserId: interaction.user.id });
			}
			if (interaction.customId === "approve") {
				if (info.caller === callerUser.id) {
					throw new InteractionError(`You cannot approve your own rename request`);
				} else if (info.approved.includes(callerUser.id)) {
					throw new InteractionError(`You cannot approve this rename request again`);
				} else if (info.rejected.includes(callerUser.id)) {
					throw new InteractionError(`You cannot approve this rename request after rejecting it`);
				} else if (!info.waiting.includes(callerUser.id)) {
					throw new InteractionError(`You are not in this team`);
				}
				removeFromArray(info.waiting, callerUser.id);
				info.approved.push(callerUser.id);
				if (info.approved.length > numMembers / 2) {
					const oldTeamName = team.name;
					// fail if another team with same name exists
					if (await findTeam(transaction, { name: info.newTeamName }) != null) {
						const options = await createTeamRenameRequestOptionsFromInfo(info, true);
						removeFromArray((await transaction.fetch(`/interactions`)).interactionIds, interaction.message.id);
						clearObject(info);
						await transaction.commit();
						await message.edit(options);
						await message.reply(`Team called ${info.newTeamName} now exists :(`);
						return;
					}
					const options = await createTeamRenameRequestOptionsFromInfo(info, true);
					await renameTeam(interaction.guild, transaction, team, info.newTeamName);
					removeFromArray((await transaction.fetch(`/interactions`)).interactionIds, interaction.message.id);
					clearObject(info);
					await transaction.commit();
					await message.edit(options);
					await message.reply(`Renamed team ${oldTeamName} to ${team.name}`);
					return;
				}
				await transaction.commit();
				await message.edit(await createTeamRenameRequestOptionsFromInfo(info));
				await interaction.followUp({ ephemeral, content: `Approved request to rename team ${team.name} to ${info.newTeamName}` });
				return;
			}
			if (interaction.customId === "reject") {
				if (info.caller === callerUser.id) {
					throw new InteractionError(`You cannot reject your own rename request`);
				} else if (info.rejected.includes(callerUser.id)) {
					throw new InteractionError(`You cannot reject this rename request again`);
				} else if (info.approved.includes(callerUser.id)) {
					throw new InteractionError(`You cannot reject this rename request after approving it`);
				} else if (!info.waiting.includes(callerUser.id)) {
					throw new InteractionError(`You are not in this team`);
				}
				removeFromArray(info.waiting, callerUser.id);
				info.rejected.push(callerUser.id);
				if (info.rejected.length >= numMembers / 2) {
					const teamName = info.newTeamName;
					const options = await createTeamRenameRequestOptionsFromInfo(info, true);
					removeFromArray((await transaction.fetch(`/interactions`)).interactionIds, interaction.message.id);
					clearObject(info);
					await transaction.commit();
					await message.edit(options);
					await message.reply(`Request to rename team ${team.name} to ${teamName} is rejected`);
					return;
				}
				await transaction.commit();
				await message.edit(await createTeamRenameRequestOptionsFromInfo(info));
				await interaction.followUp({ ephemeral, content: `Rejected request to rename team ${team.name} to ${info.newTeamName}` });
				return;
			}
			if (interaction.customId === "cancel") {
				if (info.caller !== callerUser.id) {
					throw new InteractionError(`You can't cancel someone else's request to rename team`);
				}
				const teamName = info.newTeamName;
				const options = await createTeamRenameRequestOptionsFromInfo(info, true);
				removeFromArray((await transaction.fetch(`/interactions`)).interactionIds, interaction.message.id);
				clearObject(info);
				await transaction.commit();
				await message.edit(options);
				await message.reply(`Request to rename team ${team.name} to ${teamName} is cancelled`);
				return;
			}
		}
		if (info.type === "teamJoinRandom") {
			// ensure caller
			let callerUser = await findUser(transaction, { discordUserId: interaction.user.id });
			if (callerUser == null) {
				callerUser = await createUser(interaction.guild, transaction, { id: `${interaction.id}${interaction.user.id}`, discordUserId: interaction.user.id });
			}
			if (interaction.customId === "teamUp") {
				const joinRandomInfo = await transaction.fetch(`/joinRandom`);
				// fail if its the same dude lol
				if (joinRandomInfo.caller === callerUser.id) {
					throw new InteractionError(`You can't team up with yourself`);
				}
				// generate a random team name that doesn't exist
				const teamName = `${Math.floor(Math.random() * 2000)}`
				if (await findTeam(transaction, { name: teamName }) != null)
					throw Error("lol just try again pls: team name collided");
				const otherUser = await fetchUser(transaction, joinRandomInfo.caller);
				// fail if the other dude made a team already
				if (otherUser.teamId != null) {
					throw new InteractionError(`The other user now has a team`);
				}
				// make a team with them and have it be open to others
				const team = await createTeam(interaction.guild, transaction, { id: interaction.id, name: teamName, freeToJoin: true });
				await joinTeam(interaction.guild, transaction, team, otherUser);
				await joinTeam(interaction.guild, transaction, team, callerUser);
				// remove previous message and clear info
				removeFromArray((await transaction.fetch(`/interactions`)).interactionIds ??= [], joinRandomInfo.interactionId);
				clearObject(await transaction.fetch(`/interaction/${joinRandomInfo.interactionId}`));
				clearObject(joinRandomInfo);
				// complete command
				await transaction.commit();
				await interaction.channel.send(`Team ${team.name} with members ${await interaction.guild.members.fetch(callerUser.discordUserId)} and ${await interaction.guild.members.fetch(otherUser.discordUserId)} is created`);
				await (await interaction.channel.messages.fetch(interaction.message.id)).delete();
				return;
			}
			if (interaction.customId === "cancel") {
				if (info.caller !== callerUser.id) {
					throw new InteractionError(`You can't cancel someone else's request to team up`);
				}
				// remove interaction info and joinRandom info
				removeFromArray((await transaction.fetch(`/interactions`)).interactionIds, interaction.message.id);
				clearObject(info);
				const joinRandomInfo = await transaction.fetch(`/joinRandom`);
				clearObject(joinRandomInfo);
				// complete command
				await transaction.commit();
				await interaction.followUp({ ephemeral, content: `Cancelled request to team up` });
				await (await interaction.channel.messages.fetch(interaction.message.id)).delete();
				return;
			}
		}
		if (info.type === "workshopRole") {
			const caller = await interaction.guild.members.fetch(interaction.user.id);
			const workshop = await transaction.fetch(`/workshop/${info.workshopId}`);
			if (interaction.customId === "add") {
				if (caller.roles.cache.has(workshop.discordRoleId)) {
					throw new InteractionError(`You already have the ${workshop.name} workshop role`);
				}
				await caller.roles.add(workshop.discordRoleId);
				// complete command
				await transaction.commit();
				await interaction.followUp({ ephemeral, content: `Added ${workshop.name} workshop role to you` });
				return;
			}
			if (interaction.customId === "remove") {
				if (!caller.roles.cache.has(workshop.discordRoleId)) {
					throw new InteractionError(`You already don't have the ${workshop.name} workshop role`);
				}
				await caller.roles.remove(workshop.discordRoleId);
				// complete command
				await transaction.commit();
				await interaction.followUp({ ephemeral, content: `Removed ${workshop.name} workshop role from you` });
				return;
			}
		}
	} catch (e) {
		let content: string;
		if (!(e instanceof InteractionError)) {
			console.error(e);
			content = `Oops, an internal error occurred: ${e}`;
		} else {
			content = e.message;
		}
		try {
			await interaction.followUp({ ephemeral, content });
		} catch (e) {
			console.log(`Couldn't send last error: ${e}`);
		}
	} finally {
		running = false;
	}
});

// Process slash commands
client.on("interactionCreate", async (interaction: Interaction) => {
	if (!interaction.isCommand())
		return;

	try {
		if (running) {
			throw new InteractionError("Someone else is running a command / pressing a button. Please try again later.");
		}
		running = true;

		const metadata = {
			timestamp: Date.now(),
			userDisplayName: `${interaction.user.username}#${interaction.user.discriminator}`,
			userId: interaction.user.id,
		};
		assert(interaction.guild);
		assert(interaction.channel);

		if (interaction.commandName === "ping") {
			await interaction.reply("pong");
			return;
		}

		if (interaction.commandName === "admin") {
			if (!(await interaction.guild.members.fetch(interaction.user.id)).roles.cache.find((role: Role) => ["supervisor", "leader"].includes(role.name.toLowerCase()))) {
				throw new InteractionError(`You are not an admin`);
			}
			const subcommandName = interaction.options.getSubcommand(true);
			if (subcommandName === "get") {
				if (!(await interaction.guild.members.fetch(interaction.user.id)).roles.cache.find((role: Role) => ["bot maintainer"].includes(role.name.toLowerCase()))) {
					throw new InteractionError(`You are not a bot maintainer`);
				}
				await interaction.reply({ ephemeral, content: "*getting*" });
				const key = interaction.options.getString("key", true);
				console.log([ "admin", "get", key, metadata ]);
				const [resource, ...properties] = key.split(".");
				let result = await resources.fetch(resource.trim());
				for (const property of properties)
					result = result?.[property.trim()];
				let out: string;
				if (result === undefined)
					out = "*undefined*";
				else {
					const stringified = JSON.stringify(result, null, 2);
					if (stringified.includes("\n"))
						out = "```json\n" + stringified + "\n```";
					else
						out = "`" + stringified + "`";
				}
				await interaction.followUp({ ephemeral, content: out });
				return;
			}
			if (subcommandName === "set") {
				if (!(await interaction.guild.members.fetch(interaction.user.id)).roles.cache.find((role: Role) => ["bot maintainer"].includes(role.name.toLowerCase()))) {
					throw new InteractionError(`You are not a bot maintainer`);
				}
				await interaction.reply({ ephemeral, content: "*updating*" });
				const key = interaction.options.getString("key", true);
				const value = interaction.options.getString("value", true);
				console.log([ "admin", "set", key, value, metadata ]);
				const transaction = createTransaction(resources);
				const [resource, ...properties] = key.split(".");
				const last = properties.pop();
				let result = await transaction.fetch(resource.trim());
				for (const property of properties)
					result = result?.[property.trim()];
				if (result === undefined)
					throw new Error("cannot set property of undefined");
				if (last === undefined) {
					const v = Object.assign({}, result);  // for use in the eval
					clearObject(result);
					Object.assign(result, eval(`(${value})`));
				} else {
					const v = result[last] === undefined ? undefined : JSON.parse(JSON.stringify(result[last]));
					result[last] = eval(`(${value})`);
				}
				await transaction.commit();
				await interaction.followUp({ ephemeral, content: "*updated*" });
				return;
			}
			if (subcommandName === "invalidate") {
				console.log([ "admin", "invalidate", metadata ]);
				await resources.invalidate();
				await interaction.reply({ ephemeral, content: "*invalidated*" });
				return;
			}
			if (subcommandName === "remove-from-team") {
				const teamName = interaction.options.getString("team-name", true);
				const member = await interaction.guild.members.fetch(interaction.options.getUser("member", true).id);
				console.log([ "admin", "remove-from-team", teamName, member, metadata ]);
				const transaction = createTransaction(resources);
				// fail if user doesnt exist
				const user = await findUser(transaction, { discordUserId: member.id });
				if (user == null) {
					throw new InteractionError(`User is not in a team`);
				}
				// fail if doesnt have a previous team
				if (user.teamId == null) {
					throw new InteractionError(`User is not in a team`);
				}
				// fail if team name isn't easy
				const team = await fetchTeam(transaction, user.teamId);
				if (team.name !== teamName) {
					throw new InteractionError(`User is in team called ${team.name}, not ${teamName}`);
				}
				await interaction.reply({ ephemeral, content: "Removing from team..." });
				// leave previous team
				await leaveTeam(interaction.guild, transaction, user);
				// remove team if empty
				// if ((team.memberIds ?? []).length === 0) {
				// 	await destroyTeam(interaction.guild, transaction, team);
				// }
				// reply to interaction
				await transaction.commit();
				await interaction.channel.send(`Removed ${member} from team ${teamName}`);
				return;
			}
			if (subcommandName === "add-to-team") {
				const teamName = interaction.options.getString("team-name", true);
				const member = await interaction.guild.members.fetch(interaction.options.getUser("member", true).id);
				console.log([ "admin", "remove-from-team", teamName, member, metadata ]);
				const transaction = createTransaction(resources);
				// create user if nonexistent
				let user = await findUser(transaction, { discordUserId: member.id });
				if (user == null) {
					user = await createUser(interaction.guild, transaction, { id: `${interaction.id}${member.id}`, discordUserId: member.id });
				}
				// fail if has a previous team
				if (user.teamId != null) {
					throw new InteractionError(`User is in a team`);
				}
				// fail if team name doesnt exist
				const team = await findTeam(transaction, { name: teamName });
				if (team == null) {
					throw new InteractionError(`Team called ${teamName} doesn't exist`);
				}
				await interaction.reply({ ephemeral, content: "Adding to team..." });
				// leave previous team
				await joinTeam(interaction.guild, transaction, team, user);
				// reply to interaction
				await transaction.commit();
				await interaction.channel.send(`Added <@${member.id}> to team ${teamName}`);
				return;
			}
			if (subcommandName === "create-team") {
				const member0 = await interaction.guild.members.fetch(interaction.options.getUser("member0", true));
				const member1 = await interaction.guild.members.fetch(interaction.options.getUser("member1", true));
				const member2 = interaction.options.getUser("member2", false);
				const member3 = interaction.options.getUser("member3", false);
				const members = [member0, member1];
				if (member2 != null)
					members.push(await interaction.guild.members.fetch(member2));
				if (member3 != null)
					members.push(await interaction.guild.members.fetch(member3));
				// log command and setup transaction
				console.log([ "admin", "create-team", members, metadata ]);
				const transaction = createTransaction(resources);
				const teamName = `${Math.floor(Math.random() * 2000)}`
				// fail if another team with same name exists
				if (await findTeam(transaction, { name: teamName }) != null)
					throw Error("lol just try again pls: team name collided");
				// fail if team mates aren't unique
				if ((new Set(members.map(member => member.id))).size !== members.length)
					throw new InteractionError(`A member was repeated in the command`);
				// create caller and team mates
				const membersUsers = await Promise.all(members.map(async member => {
					let memberUser = await findUser(transaction, { discordUserId: member.id });
					if (!memberUser)
						memberUser = await createUser(interaction.guild, transaction, { id: `${interaction.id}${member.id}`, discordUserId: member.id });
					return memberUser;
				}));
				// fail if a team mate is already in a team
				for (const memberUser of membersUsers)
					if (memberUser.teamId != null)
						throw new InteractionError(`A member is still in a team`);
				// create team
				await interaction.reply({ ephemeral, content: `Creating team...` });
				const team = await createTeam(interaction.guild, transaction, {
					id: interaction.id,
					name: teamName,
				});
				for (const memberUser of membersUsers)
					await joinTeam(interaction.guild, transaction, team, memberUser);
				// complete command and commit transaction
				await transaction.commit();
				await interaction.channel.send(`Created team ${teamName}`);
				return;
			}
			if (subcommandName === "delete-team") {
				const teamName = interaction.options.getString("team-name", true);
				console.log([ "admin", "delete-team", teamName, metadata ]);
				const transaction = createTransaction(resources);
				// fail if team doesnt exist
				const team = await findTeam(transaction, { name: teamName });
				if (team == null) {
					throw new InteractionError(`Team does not exist`);
				}
				const teamMates = [];
				for (const memberId of team.memberIds) {
					teamMates.push(await fetchUser(transaction, memberId));
				};
				// confirmation with a list of ppl in the team
				const customIdPrefix = `${Date.now()}${interaction.user.id}`;
				await interaction.reply({
					ephemeral,
					content: `Just to confirm, are you attempting to destroy team ${team.name} with members ${teamMates.map(m => `<@${m.discordUserId}>`).join(", ")}?`,
					components: [
						new MessageActionRow().addComponents(
							new MessageButton()
								.setCustomId(customIdPrefix + "yes")
								.setLabel("Confirm")
								.setStyle("DANGER"),
							new MessageButton()
								.setCustomId(customIdPrefix + "no")
								.setLabel("Cancel")
								.setStyle("SECONDARY"),
						),
					],
				});
				// using awaitMessageComponent here because confirming stuff after more then 15 mins is sus
				const nextInteraction = await new Promise(resolve => {
					assert(interaction.channel);
					const collector = interaction.channel.createMessageComponentCollector({
						filter: (i: MessageComponentInteraction) => i.customId.startsWith(customIdPrefix) && i.user.id === interaction.user.id,
						time: 10000,
						max: 1,
					});
					collector.on("end", collected => resolve(collected.first()));
				}) as MessageComponentInteraction | undefined;
				if (nextInteraction == null) {
					throw new InteractionError(`Confirmation timed out`);
				}
				if (nextInteraction.customId.endsWith("no")) {
					throw new InteractionError(`Cancelled team destruction`);
				}
				await interaction.followUp({ ephemeral, content: `Destroying team...` });
				// destroy team
				for (const teamMate of teamMates) {
					await leaveTeam(interaction.guild, transaction, teamMate);
				}
				await destroyTeam(interaction.guild, transaction, team);
				// reply to interaction
				await transaction.commit();
				await interaction.channel.send(`Destroyed team ${teamName}`);
				return;
			}
			if (subcommandName === "rename-team") {
				const teamName = interaction.options.getString("team-name", true);
				const newTeamName = interaction.options.getString("new-team-name", true);
				console.log([ "admin", "rename-team", teamName, newTeamName, metadata ]);
				const transaction = createTransaction(resources);
				// fail if team doesnt exist
				const team = await findTeam(transaction, { name: teamName });
				if (team == null) {
					throw new InteractionError(`Team does not exist`);
				}
				await interaction.reply({ ephemeral, content: `Renaming team...` });
				// rename team
				await renameTeam(interaction.guild, transaction, team, newTeamName);
				// reply to interaction
				await transaction.commit();
				await interaction.channel.send(`Renamed ${teamName} to ${newTeamName}`);
				return;
			}
			if (subcommandName === "move-to-breakout-rooms") {
				const workshopCode = interaction.options.getString("workshop-code", true);
				console.log([ "admin", "move-to-breakout-rooms", workshopCode, metadata ]);
				const transaction = createTransaction(resources);
				// fail if workshop doesn't exist
				const workshop = await transaction.fetch(`/workshop/${workshopCode}`);
				if (workshop.id == null) {
					throw new InteractionError(`Workshop does not exist`);
				}
				await interaction.reply({ ephemeral, content: `Moving people to their team voice channels...` });
				// move everyone in a workshop to their respective teams if they have one
				const channel = await interaction.guild.channels.fetch(workshop.discordVoiceChannelId);
				assert(channel);
				for (const [memberId, member] of channel.members.entries()) {
					let user = await findUser(transaction, { discordUserId: memberId });
					if (user == null) continue;
					if (user.teamId == null) continue;
					const team = await fetchTeam(transaction, user.teamId);
					const teamVoiceChannel = await interaction.guild.channels.fetch(team.discordVoiceChannelId) as VoiceChannel;
					await member.edit({ channel: teamVoiceChannel });
					await sleep(250);  // hopefully this is enough lol
				}
				// reply to interaction
				await transaction.commit();
				await interaction.channel.send(`Moved people who have a team into their voice channel`);
				return;
			}
			if (subcommandName === "register-workshop") {
				const workshopCode = interaction.options.getString("workshop-code", true);
				const workshopName = interaction.options.getString("workshop-name", true);
				console.log([ "admin", "register-workshop", workshopCode, workshopName, metadata ]);
				const transaction = createTransaction(resources);
				// fail if workshop code has caps or spaces
				if (!/^[-a-z0-9]+$/g.test(workshopCode)) {
					throw new InteractionError(`Workshop code can only have lowercase letters and dashes`);
				}
				// fail if workshop with code exists
				const workshop = await transaction.fetch(`/workshop/${workshopCode}`);
				if (workshop.id != null) {
					throw new InteractionError(`Workshop with same code exists`);
				}
				// fail if no workshops category exists
				const workshopsCategory = (await interaction.guild.channels.fetch()).find((channel: { name: string; }) => (
					channel instanceof CategoryChannel
					&& channel.name.toLowerCase() === "workshops"
				)) as CategoryChannel | undefined;
				if (workshopsCategory == null) {
					throw new InteractionError(`No "workshops" category exists`);
				}
				// fail if no workshops channel exists
				const workshopsChannel = (await interaction.guild.channels.fetch()).find((channel: { name: string; }) => (
					channel instanceof TextChannel
					&& channel.name.toLowerCase() === "workshops"
				)) as TextChannel | undefined;
				if (workshopsChannel == null) {
					throw new InteractionError(`No "workshops" channel exists`);
				}
				await interaction.reply({ ephemeral, content: `Creating workshop...` });
				// create workshop
				((await transaction.fetch(`/workshops`)).ids ??= []).push(workshopCode);
				workshop.id = workshopCode;
				workshop.name = workshopName;
				workshop.hostDiscordUserId = interaction.user.id;
				// create delayed interaction info
				const message = await workshopsChannel.send("...");
				((await transaction.fetch(`/interactions`)).interactionIds ??= []).push(message.id);
				const info = await transaction.fetch(`/interaction/${message.id}`);
				Object.assign(info, {
					id: message.id,
					type: "workshopRole",
					workshopId: workshop.id,
				});
				workshop.interactionId = message.id;
				// create workshop role
				const role = await interaction.guild.roles.create({ name: `${workshopName}` });
				workshop.discordRoleId = role.id;
				// create workshop channels
				const channelOptions = { parent: workshopsCategory };
				const textChannel = await interaction.guild.channels.create(`${workshopName}`, { ...channelOptions });
				const voiceChannel = await interaction.guild.channels.create(`${workshopName}`, { type: "GUILD_VOICE", ...channelOptions });
				workshop.discordTextChannelId = textChannel.id;
				workshop.discordVoiceChannelId = voiceChannel.id;
				// reply to interaction
				await transaction.commit();
				await interaction.followUp({ ephemeral, content: `Created workshop` });
				await message.edit({
					content: (
						`New ${workshopName} workshop by ${interaction.user}! (code: ${workshopCode})\n`
						+ `Text Channel: <#${workshop.discordTextChannelId}>\n`
						+ `Voice Channel: <#${workshop.discordVoiceChannelId}>\n`
						+ `Press the button to get the workshop role (The host will ping this role for workshop specific announcements)`
					),
					components: [
						new MessageActionRow().addComponents(
							new MessageButton()
								.setCustomId("add")
								.setLabel(`Get the ${workshopName} role`)
								.setStyle("SUCCESS"),
							new MessageButton()
								.setCustomId("remove")
								.setLabel(`Leave the ${workshopName} role`)
								.setStyle("DANGER"),
						),
					]
				});
				return;
			}
			if (subcommandName === "list-all-teams") {
				console.log([ "admin", "list-all-teams", metadata ]);
				const result = [];
				let first = true;
				for (const teamId of (await fetchTeams(resources)).teamIds) {
					const team = await fetchTeam(resources, teamId);
					const teamMates = [];
					for (const memberId of team.memberIds) {
						teamMates.push(await fetchUser(resources, memberId));
					};
					result.push(`Team ${team.name} with ID ${team.id} and members ${teamMates.map(member => `<@${member.discordUserId}>`).join(", ")}`);
					if (result.length >= 8) {
						if (first) {
							await interaction.reply({ ephemeral, content: result.join("\n"), allowedMentions: { parse: [] } });
							first = false;
						} else {
							await interaction.followUp({ ephemeral, content: result.join("\n"), allowedMentions: { parse: [] } });
						}
						result.splice(0, result.length);
					}
				}
				if (result.length > 0) {
					if (first) {
						await interaction.reply({ ephemeral, content: result.join("\n"), allowedMentions: { parse: [] } });
					} else {
						await interaction.followUp({ ephemeral, content: result.join("\n"), allowedMentions: { parse: [] } });
					}
				} else if (first) {
					await interaction.reply({ ephemeral, content: "no teams :/" });
				}
				return;
			}
			if (subcommandName === "list-all-workshops") {
				console.log([ "admin", "list-all-workshops", metadata ]);
				const result = [];
				let first = true;
				for (const workshopId of (await resources.fetch(`/workshops`)).ids ??= []) {
					const workshop = await resources.fetch(`/workshop/${workshopId}`);
					result.push(`${workshop.name} with code ${workshop.id} hosted by <@${workshop.hostDiscordUserId}>`);
					if (result.length >= 8) {
						if (first) {
							await interaction.reply({ ephemeral, content: result.join("\n"), allowedMentions: { parse: [] } });
							first = false;
						} else {
							await interaction.followUp({ ephemeral, content: result.join("\n"), allowedMentions: { parse: [] } });
						}
						result.splice(0, result.length);
					}
				}
				if (result.length > 0) {
					if (first) {
						await interaction.reply({ ephemeral, content: result.join("\n"), allowedMentions: { parse: [] } });
					} else {
						await interaction.followUp({ ephemeral, content: result.join("\n"), allowedMentions: { parse: [] } });
					}
				} else if (first) {
					await interaction.reply({ ephemeral, content: "no workshops :/" });
				}
				return;
			}
			if (subcommandName === "delete-workshop") {
				const workshopCode = interaction.options.getString("workshop-code", true);
				const removeFromDatastore = interaction.options.getBoolean("remove-from-datastore", false) ?? false;
				console.log([ "admin", "delete-workshop", workshopCode, metadata ]);
				const transaction = createTransaction(resources);
				// fail if workshop doesnt exist
				const workshop = await transaction.fetch(`/workshop/${workshopCode}`);
				if (workshop.id == null) {
					throw new InteractionError(`Workshop does not exist`);
				}
				// confirmation
				const customIdPrefix = `${Date.now()}${interaction.user.id}`;
				await interaction.reply({
					ephemeral,
					content: `Just to confirm, are you attempting to destroy workshop ${workshop.name} with code ${workshop.id}`,
					components: [
						new MessageActionRow().addComponents(
							new MessageButton()
								.setCustomId(customIdPrefix + "yes")
								.setLabel("Confirm")
								.setStyle("DANGER"),
							new MessageButton()
								.setCustomId(customIdPrefix + "no")
								.setLabel("Cancel")
								.setStyle("SECONDARY"),
						),
					],
				});
				// using awaitMessageComponent here because confirming stuff after more then 15 mins is sus
				const nextInteraction = await new Promise(resolve => {
					assert(interaction.channel);
					const collector = interaction.channel.createMessageComponentCollector({
						filter: (i: MessageComponentInteraction) => i.customId.startsWith(customIdPrefix) && i.user.id === interaction.user.id,
						time: 10000,
						max: 1,
					});
					collector.on("end", collected => resolve(collected.first()));
				}) as MessageComponentInteraction | undefined;
				if (nextInteraction == null) {
					throw new InteractionError(`Confirmation timed out`);
				}
				if (nextInteraction.customId.endsWith("no")) {
					throw new InteractionError(`Cancelled workshop destruction`);
				}
				await interaction.followUp({ ephemeral, content: `Destroying workshop...` });
				// destroy workshop interaction
				if (workshop.interactionId) {
					removeFromArray((await transaction.fetch(`/interactions`)).ids ??= [], workshop.interactionId);
					clearObject(await transaction.fetch(`/interaction/${workshop.interactionId}`));
					delete workshop.interactionId;
				}
				// destroy workshop role
				if (workshop.discordRoleId) {
					const role = await interaction.guild.roles.fetch(workshop.discordRoleId);
					assert(role);
					await role.delete();
					delete workshop.discordRoleId;
				}
				// destroy workshop channels
				if (workshop.discordTextChannelId) {
					const textChannel = await interaction.guild.channels.fetch(workshop.discordTextChannelId);
					assert(textChannel);
					await textChannel.delete();
					delete workshop.discordTextChannelId;
				}
				if (workshop.discordVoiceChannelId) {
					const voiceChannel = await interaction.guild.channels.fetch(workshop.discordVoiceChannelId);
					assert(voiceChannel);
					await voiceChannel.delete();
					delete workshop.discordVoiceChannelId;
				}
				// destroy team if required
				if (removeFromDatastore) {
					removeFromArray((await transaction.fetch(`/workshops`)).ids ??= [], workshop.id);
					clearObject(workshop);
					// reply to interaction
					await transaction.commit();
					await interaction.channel.send(`Destroyed workshop ${workshopCode} and removed it from the datastore`);
					return;
				}
				// reply to interaction
				await transaction.commit();
				await interaction.channel.send(`Destroyed workshop ${workshopCode}`);
				return;
			}
			if (subcommandName === "create-support") {
				const channelType = interaction.options.getString("type", true);
				console.log([ "admin", "create-support", channelType, metadata ]);
				// fail if no help category exists
				const helpCategory = (await interaction.guild.channels.fetch()).find((channel: { name: string; }) => (
					channel instanceof CategoryChannel
					&& channel.name.toLowerCase() === "help"
				)) as CategoryChannel | undefined;
				if (helpCategory == null) {
					throw new InteractionError(`No "help" category exists`);
				}
				const channelName = `Help ${Math.floor(Math.random() * 2000)}`
				await interaction.reply({ ephemeral, content: `Creating ${channelType} support channel ${channelName}...` });
				let channel;
				if (channelType === "text") {
					channel = await interaction.guild.channels.create(channelName, { parent: helpCategory });
				} else {
					channel = await interaction.guild.channels.create(channelName, { parent: helpCategory, type: "GUILD_VOICE" });
				}
				// reply to interaction
				await interaction.channel.send(`Created ${channelType} support channel ${channel}`);
				return;
			}
			if (subcommandName === "register-challenge") {
				const name = interaction.options.getString("name", true);
				const points = interaction.options.getNumber("points", true);
				const workshopResolvable = interaction.options.getString("workshop") || undefined;
				console.log([ "admin", "register-challenge", name, points, workshopResolvable, metadata ]);
				const transaction = createTransaction(resources);
				// fail if workshop couldn't be resolved
				let workshop = undefined;
				if (workshopResolvable) {
					workshop = await transaction.fetch(`/workshop/${workshopResolvable}`);
					if (workshop.id == null) {
						workshops: {
							for (const workshopId of (await transaction.fetch(`/workshops`)).ids ??= []) {
								workshop = await transaction.fetch(`/workshop/${workshopId}`);
								if (workshop.name === workshopResolvable)
									break workshops;
							}
							throw new InteractionError(`Could not resolve workshop ${workshopResolvable}`);
						}
					}
				}
				// reply to interaction
				await interaction.reply({ ephemeral, content: `Creating challenge...` });
				// create challenge
				const challengeInfo: Record<string, any> = {
					id: interaction.id,
					name: name,
					points: points,
					judgeDiscordUserId: interaction.user.id,
					createdTimestamp: Date.now(),
				};
				if (workshop)
					challengeInfo.workshopId = workshop.id;
				((await transaction.fetch(`/challenges`)).ids ??= []).push(challengeInfo.id);
				if (workshop)
					(workshop.challengeIds ??= []).push(challengeInfo.id);
				const challenge = await transaction.fetch(`/challenges/${challengeInfo.id}`);
				Object.assign(challenge, challengeInfo);
				// commit and complete
				await transaction.commit();
				await interaction.channel.send(
					`Created challenge ${challengeInfo.name} (id: ${challengeInfo.id})\n`
					+ (workshop ? ` - Workshop: ${workshop.name} (id: ${workshop.id})\n` : "")
					+ ` - Points: ${challengeInfo.points}\n`
				);
				return;
			}
			if (subcommandName === "give-team") {
				const teamResolvable = interaction.options.getString("team", true);
				const challengeResolvables = interaction.options.getString("challenges", true).split(",").map(s => s.trim());
				const content = interaction.options.getString("content") || undefined;
				console.log([ "admin", "give-team", teamResolvable, challengeResolvables, content, metadata ]);
				const transaction = createTransaction(resources);
				// fail if team couldn't be resolved
				let team = await fetchTeam(transaction, teamResolvable);
				if (!team || team.name == null) {
					const teamByName = await findTeam(transaction, { name: teamResolvable });
					if (!teamByName)
						throw new InteractionError(`Could not resolve team ${teamResolvable}`);
					team = teamByName;
				}
				// fail if any challenge couldn't be resolved
				const challenges = [];
				for (const challengeResolvable of challengeResolvables) {
					let challenge = await transaction.fetch(`/challenges/${challengeResolvable}`);
					if (challenge.id == null) {
						challenges: {
							for (const challengeId of (await transaction.fetch(`/challenges`)).ids ??= []) {
								challenge = await transaction.fetch(`/challenges/${challengeId}`);
								if (challenge.name === challengeResolvable)
									break challenges;
							}
							throw new InteractionError(`Could not resolve challenge ${challengeResolvable}`);
						}
					}
					challenges.push(challenge);
				}
				// reply to interaction
				await interaction.reply({ ephemeral, content: `Creating submission to challenge and applying to team...` });
				// create submission
				const submissionInfo: Record<string, any> = {
					id: interaction.id,
					teamId: team.id,
					challengeIds: challenges.map(c => c.id),
					judgeDiscordUserId: interaction.user.id,
					judgedTimestamp: Date.now(),
				};
				if (content)
					submissionInfo.content = content;
				((await transaction.fetch(`/submissions`)).ids ??= []).push(submissionInfo.id);
				for (const challenge of challenges)
					(challenge.submissionIds ??= []).push(submissionInfo.id);
				(team.submissionIds ??= []).push(submissionInfo.id);
				const submission = await transaction.fetch(`/submissions/${submissionInfo.id}`);
				Object.assign(submission, submissionInfo);
				// commit and complete
				await transaction.commit();
				await interaction.channel.send(
					`Created submission (id: ${submissionInfo.id})\n`
					+ ` - Challenges: ${challenges.map(c => `${c.name} (id: ${c.id})`).join(", ")}\n`
					+ ` - Team: ${team.name} (id: ${team.id})\n`
					+ ` - Points: ${challenges.reduce((p, c) => p + c.points, 0)}\n`
				);
				return;
			}
			if (subcommandName === "give-team-of") {
				const member = await interaction.guild.members.fetch(interaction.options.getUser("member", true).id);
				const challengeResolvables = interaction.options.getString("challenges", true).split(",").map(s => s.trim());
				const content = interaction.options.getString("content") || undefined;
				console.log([ "admin", "give-team-of", `${member.user.username}#${member.user.discriminator}`, challengeResolvables, content, metadata ]);
				const transaction = createTransaction(resources);
				// fail if user doesnt exist or doesnt have a previous team
				const user = await findUser(transaction, { discordUserId: member.id });
				if (!user || user.teamId == null) {
					throw new InteractionError(`User is not in a team`);
				}
				// fail if any challenge couldn't be resolved
				const challenges = [];
				for (const challengeResolvable of challengeResolvables) {
					let challenge = await transaction.fetch(`/challenges/${challengeResolvable}`);
					if (challenge.id == null) {
						challenges: {
							for (const challengeId of (await transaction.fetch(`/challenges`)).ids ??= []) {
								challenge = await transaction.fetch(`/challenges/${challengeId}`);
								if (challenge.name === challengeResolvable)
									break challenges;
							}
							throw new InteractionError(`Could not resolve challenge ${challengeResolvable}`);
						}
					}
					challenges.push(challenge);
				}
				// reply to interaction
				await interaction.reply({ ephemeral, content: `Creating submission to challenge and applying to team of member...` });
				// get team
				const team = await fetchTeam(transaction, user.teamId);
				// create submission
				const submissionInfo: Record<string, any> = {
					id: interaction.id,
					teamId: team.id,
					memberId: user.id,
					challengeIds: challenges.map(c => c.id),
					judgeDiscordUserId: interaction.user.id,
					judgedTimestamp: Date.now(),
				};
				if (content)
					submissionInfo.content = content;
				((await transaction.fetch(`/submissions`)).ids ??= []).push(submissionInfo.id);
				for (const challenge of challenges)
					(challenge.submissionIds ??= []).push(submissionInfo.id);
				(team.submissionIds ??= []).push(submissionInfo.id);
				const submission = await transaction.fetch(`/submissions/${submissionInfo.id}`);
				Object.assign(submission, submissionInfo);
				// commit and complete
				await transaction.commit();
				await interaction.channel.send({
					allowedMentions: { parse: [] },
					content: (
						`Created submission (id: ${submissionInfo.id})\n`
						+ ` - Challenges: ${challenges.map(c => `${c.name} (id: ${c.id})`).join(", ")}\n`
						+ ` - Member: <@${user.discordUserId}> (id: ${user.id})\n`
						+ ` - Team: ${team.name} (id: ${team.id})\n`
						+ ` - Points: ${challenges.reduce((p, c) => p + c.points, 0)}\n`
					),
				});
				return;
			}
			if (subcommandName === "get-submission") {
				const submissionId = interaction.options.getString("submission-id", true);
				console.log([ "admin", "get-submission", submissionId, metadata ]);
				// fail if submission doesn't exist
				let submission = await resources.fetch(`/submissions/${submissionId}`);
				if (submission.id == null)
					throw new InteractionError(`Could not find submission with id: ${submissionId}`);
				// get linked stuff
				const team = await fetchTeam(resources, submission.teamId);
				const user = submission.memberId ? await fetchUser(resources, submission.memberId) : undefined;
				const challenges = [];
				for (const challengeId of submission.challengeIds)
					challenges.push(await resources.fetch(`/challenges/${challengeId}`));
				// complete
				await interaction.reply({
					ephemeral,
					content: (
						`Submission (id: ${submission.id}):\n`
						+ ` - Challenges: ${challenges.map(c => `${c.name} (id: ${c.id})`).join(", ")}\n`
						+ (user ? ` - Member: <@${user.discordUserId}> (id: ${user.id})\n` : "")
						+ ` - Team: ${team.name} (id: ${team.id})\n`
						+ ` - Points: ${challenges.reduce((p, c) => p + c.points, 0)}\n`
						+ (submission.content ? ` - Content: ${submission.content}\n` : "")
					),
				});
				return;
			}
			if (subcommandName === "get-challenge") {
				const challengeResolvable = interaction.options.getString("challenge", true);
				console.log([ "admin", "get-challenge", challengeResolvable, metadata ]);
				// fail if challenge couldn't be resolved
				let challenge = await resources.fetch(`/challenges/${challengeResolvable}`);
				if (challenge.id == null) {
					challenges: {
						for (const challengeId of (await resources.fetch(`/challenges`)).ids ??= []) {
							challenge = await resources.fetch(`/challenges/${challengeId}`);
							if (challenge.name === challengeResolvable)
								break challenges;
						}
						throw new InteractionError(`Could not resolve challenge ${challengeResolvable}`);
					}
				}
				// get linked stuff
				const workshop = challenge.workshopId ? await resources.fetch(`/workshop/${challenge.workshopId}`) : undefined;
				// complete
				await interaction.reply({
					ephemeral,
					content: (
						`Challenge ${challenge.name} (id: ${challenge.id})\n`
						+ (workshop ? `- Workshop: ${workshop.name} (id: ${workshop.id})\n` : "")
						+ `- Points: ${challenge.points}\n`
						+ `- Submission IDs: ${(challenge.submissionIds ?? []).join(", ")}\n`
					),
				});
				return;
			}
			if (subcommandName === "delete-submission") {
				const submissionId = interaction.options.getString("submission-id", true);
				console.log([ "admin", "delete-submission", submissionId, metadata ]);
				const transaction = createTransaction(resources);
				// fail if submission doesn't exist
				let submission = await transaction.fetch(`/submissions/${submissionId}`);
				if (submission.id == null)
					throw new InteractionError(`Could not find submission with id: ${submissionId}`);
				// get team / challenge
				const team = await fetchTeam(transaction, submission.teamId);
				const user = submission.memberId ? await fetchUser(transaction, submission.memberId) : undefined;
				const challenges = [];
				for (const challengeId of submission.challengeIds)
					challenges.push(await transaction.fetch(`/challenges/${challengeId}`));
				// confirmation
				const customIdPrefix = `${Date.now()}${interaction.user.id}`;
				await interaction.reply({
					ephemeral,
					content: (
						`Just to confirm, are you attempting to`
						+ ` destroy submission (id: ${submission.id})\n`
						+ ` - Challenges: ${challenges.map(c => `${c.name} (id: ${c.id})`).join(", ")}\n`
						+ (user ? ` - Member: <@${user.discordUserId}> (id: ${user.id})\n` : "")
						+ ` - Team: ${team.name} (id: ${team.id})\n`
						+ ` - Points: ${challenges.reduce((p, c) => p + c.points, 0)}\n`
						+ (submission.content ? ` - Content: ${submission.content}\n` : "")
					),
					components: [
						new MessageActionRow().addComponents(
							new MessageButton()
								.setCustomId(customIdPrefix + "yes")
								.setLabel("Confirm")
								.setStyle("DANGER"),
							new MessageButton()
								.setCustomId(customIdPrefix + "no")
								.setLabel("Cancel")
								.setStyle("SECONDARY"),
						),
					],
				});
				const nextInteraction = await new Promise(resolve => {
					assert(interaction.channel);
					const collector = interaction.channel.createMessageComponentCollector({
						filter: i => i.customId.startsWith(customIdPrefix) && i.user.id === interaction.user.id,
						time: 10_000,
						max: 1,
					});
					collector.on("end", collected => resolve(collected.first()));
				}) as MessageComponentInteraction | undefined;
				if (!nextInteraction)
					throw new InteractionError(`Confirmation timed out`);
				if (nextInteraction.customId.endsWith("no"))
					throw new InteractionError(`Cancelled submission destruction`);
				// reply to interaction
				await interaction.followUp({ ephemeral, content: `Removing submission...` });
				// remove submission
				removeFromArray((await transaction.fetch(`/submissions`)).ids ??= [], submission.id);
				for (const challenge of challenges)
					removeFromArray(challenge.submissionIds ??= [], submission.id);
				removeFromArray(team.submissionIds ??= [], submission.id);
				const submissionInfo = Object.assign({}, submission);
				clearObject(submission);
				// commit and complete
				await transaction.commit();
				await interaction.channel.send({
					allowedMentions: { parse: [] },
					content: (
						`Removed submission (id: ${submissionInfo.id})\n`
						+ ` - Challenges: ${challenges.map(c => `${c.name} (id: ${c.id})`).join(", ")}\n`
						+ (user ? ` - Member: <@${user.discordUserId}> (id: ${user.id})\n` : "")
						+ ` - Team: ${team.name} (id: ${team.id})\n`
						+ ` - Points: ${challenges.reduce((p, c) => p + c.points, 0)}\n`
					),
				});
				return;
			}
			if (subcommandName === "delete-challenge") {
				const challengeResolvable = interaction.options.getString("challenge", true);
				console.log([ "admin", "delete-challenge", challengeResolvable, metadata ]);
				const transaction = createTransaction(resources);
				// fail if challenge couldn't be resolved
				let challenge = await transaction.fetch(`/challenges/${challengeResolvable}`);
				if (challenge.id == null) {
					challenges: {
						for (const challengeId of (await transaction.fetch(`/challenges`)).ids ??= []) {
							challenge = await transaction.fetch(`/challenges/${challengeId}`);
							if (challenge.name === challengeResolvable)
								break challenges;
						}
						throw new InteractionError(`Could not resolve challenge ${challengeResolvable}`);
					}
				}
				// prevent deletion of challenges with submissions
				if ((challenge.submissionIds ?? []).length > 0)
					throw new InteractionError(`Challenge ${challenge.name} (id: ${challenge.id}) has ${challenge.submissionIds.length} submissions :/`);
				// get workshop
				const workshop = challenge.workshopId ? await transaction.fetch(`/workshop/${challenge.workshopId}`) : undefined;
				// confirmation
				const customIdPrefix = `${Date.now()}${interaction.user.id}`;
				await interaction.reply({
					ephemeral,
					content: (
						`Just to confirm, are you attempting to`
						+ ` destroy challenge ${challenge.name} (id: ${challenge.id})\n`
						+ (workshop ? ` - Workshop: ${workshop.name} (id: ${workshop.id})\n` : "")
						+ ` - Points: ${challenge.points}\n`
					),
					components: [
						new MessageActionRow().addComponents(
							new MessageButton()
								.setCustomId(customIdPrefix + "yes")
								.setLabel("Confirm")
								.setStyle("DANGER"),
							new MessageButton()
								.setCustomId(customIdPrefix + "no")
								.setLabel("Cancel")
								.setStyle("SECONDARY"),
						),
					],
				});
				const nextInteraction = await new Promise(resolve => {
					assert(interaction.channel);
					const collector = interaction.channel.createMessageComponentCollector({
						filter: i => i.customId.startsWith(customIdPrefix) && i.user.id === interaction.user.id,
						time: 10_000,
						max: 1,
					});
					collector.on("end", collected => resolve(collected.first()));
				}) as MessageComponentInteraction | undefined;
				if (!nextInteraction)
					throw new InteractionError(`Confirmation timed out`);
				if (nextInteraction.customId.endsWith("no"))
					throw new InteractionError(`Cancelled challenge destruction`);
				// reply to interaction
				await interaction.followUp({ ephemeral, content: `Removing challenge...` });
				// remove submission
				removeFromArray((await transaction.fetch(`/challenges`)).ids ??= [], challenge.id);
				if (workshop)
					removeFromArray(workshop.challengeIds ??= [], challenge.id);
				const challengeInfo = Object.assign({}, challenge);
				clearObject(challenge);
				// commit and complete
				await transaction.commit();
				await interaction.channel.send({
					allowedMentions: { parse: [] },
					content: (
						`Removed challenge ${challengeInfo.name} (id: ${challengeInfo.id})\n`
						+ (workshop ? ` - Workshop: ${workshop.name} (id: ${workshop.id})\n` : "")
						+ ` - Points: ${challengeInfo.points}\n`
					),
				});
				return;
			}
		}

		if (interaction.commandName === "profile") {
			console.log([ "profile", metadata ]);
			// find user and create if doesnt exist
			let user = await findUser(resources, { discordUserId: interaction.user.id });
			if (!user) {
				const transaction = createTransaction(resources);
				user = await createUser(interaction.guild, transaction, { id: interaction.id, discordUserId: interaction.user.id });
				await transaction.commit();
			}
			// get current team / points / medals
			// get team
			const teamId = user.teamId;
			const teamName = teamId && (await fetchTeam(resources, teamId)).name;
			/*
			// get points this month
			const pointsThisMonth = [...user.pointEvents || []].reduce((points, { type, deltaPoints }) => {
				if (type == "add") {
					return points + deltaPoints;
				}
				if (type == "clear") {
					return 0;
				}
			}, 0);
			// get number of medals
			const numMedals = [...user.medalEvents || []].reduce((numMedals, { type }) => {
				if (type == "add") {
					return numMedals + 1;
				}
			}, 0);
			*/
			const pointsThisMonth = 0; const numMedals = 0;
			// build response
			const parts = [];
			parts.push(`Summary for ${metadata.userDisplayName}`);
			if (teamId)
				parts.push(`- Team: ${teamName}`);
			parts.push(`- Points this month: ${pointsThisMonth}`);
			parts.push(`- Medals: ${numMedals}`);
			// send response
			await interaction.reply({ content: parts.join("\n"), allowedMentions: { parse: [] }});
			return;
		}

		if (interaction.commandName === "team") {
			const subcommandName = interaction.options.getSubcommand(true);
			if (subcommandName === "create") {
				const teamName = interaction.options.getString("team-name", true);
				const member1 = await interaction.guild.members.fetch(interaction.options.getUser("member1", true));
				const member2 = interaction.options.getUser("member2", false);
				const member3 = interaction.options.getUser("member3", false);
				const teamMates = [member1];
				if (member2 != null)
					teamMates.push(await interaction.guild.members.fetch(member2));
				if (member3 != null)
					teamMates.push(await interaction.guild.members.fetch(member3));
				// log command and setup transaction
				console.log([ "team", "create", teamName, teamMates, metadata ]);
				const transaction = createTransaction(resources);
				// fail if another team with same name exists
				if (await findTeam(transaction, { name: teamName }) != null) {
					throw new InteractionError(`Team ${teamName} already exists`);
				}
				// fail if name is longer than 32 characters
				if (!(teamName.length <= 32)) {
					throw new InteractionError(`The name ${teamName} is too long`);
				}
				// fail if caller was specified
				if (teamMates.some(member => interaction.user.id === member.id)) {
					throw new InteractionError(`You can't add yourself as a team mate`);
				}
				// fail if team mates aren't unique
				if ((new Set(teamMates.map(member => member.id))).size !== teamMates.length) {
					throw new InteractionError(`A team mate was repeated`);
				}
				// create caller and team mates
				let callerUser = await findUser(transaction, { discordUserId: interaction.user.id });
				if (!callerUser)
					callerUser = await createUser(interaction.guild, transaction, { id: `${interaction.id}${interaction.user.id}`, discordUserId: interaction.user.id });
				const teamMateUsers = await Promise.all(teamMates.map(async teamMate => {
					let teamMateUser = await findUser(transaction, { discordUserId: teamMate.id });
					if (!teamMateUser)
						teamMateUser = await createUser(interaction.guild, transaction, { id: `${interaction.id}${teamMate.id}`, discordUserId: teamMate.id });
					return teamMateUser;
				}));
				// fail if caller is already in a team
				if (callerUser.teamId != null) {
					throw new InteractionError(`You are still in a team`);
				}
				// fail if a team mate is already in a team
				for (const teamMateUser of teamMateUsers) {
					if (teamMateUser.teamId != null) {
						throw new InteractionError(`A team mate is still in a team`);
					}
				}
				// complete command and commit transaction
				await interaction.reply({ ephemeral, content: `Creating team invitation...` });
				await transaction.commit();
				// create message that has buttons for confirming stuff
				const reply = await interaction.channel.send(createTeamInvitationOptions(teamName, `<@${callerUser.discordUserId}>`, teamMateUsers.map(u => `<@${u.discordUserId}>`), [], [], true));
				// create delayed interaction info
				const transaction2 = createTransaction(resources);
				((await transaction2.fetch(`/interactions`)).interactionIds ??= []).push(reply.id);
				const info = await transaction2.fetch(`/interaction/${reply.id}`);
				Object.assign(info, {
					id: reply.id,
					type: "teamCreate",
					futureTeamId: interaction.id,
					futureTeamName: teamName,
					waiting: teamMateUsers.map(u => u.id),
					accepted: [],
					declined: [],
					caller: callerUser.id,
				});
				await transaction2.commit();
				// enable the buttons
				await reply.edit(createTeamInvitationOptions(teamName, `<@${callerUser.discordUserId}>`, teamMateUsers.map(u => `<@${u.discordUserId}>`), [], []));
				return;
			}
			if (subcommandName === "join") {
				const teamName = interaction.options.getString("team-name", true);
				// log command and setup transaction
				console.log([ "team", "join", teamName, metadata ]);
				const transaction = createTransaction(resources);
				// fail if team with name doesnt exists
				const team = await findTeam(transaction, { name: teamName });
				if (team == null) {
					throw new InteractionError(`Team ${teamName} doesn't exist`);
				}
				// create caller
				let callerUser = await findUser(transaction, { discordUserId: interaction.user.id });
				if (!callerUser)
					callerUser = await createUser(interaction.guild, transaction, { id: `${interaction.id}${interaction.user.id}`, discordUserId: interaction.user.id });
				// fail if caller is already in a team
				if (callerUser.teamId != null) {
					throw new InteractionError(`You are still in a team`);
				}
				const teamMateDiscordIds = [];
				for (const memberId of team.memberIds) {
					teamMateDiscordIds.push((await fetchUser(transaction, memberId)).discordUserId);
				};
				// confirm with caller
				const customIdPrefix = `${Date.now()}${interaction.user.id}`;
				await interaction.reply({
					ephemeral,
					content: `Just to confirm, are you attempting to join team ${team.name} with members ${teamMateDiscordIds.map(i => `<@${i}>`).join(", ")}?`,
					components: [
						new MessageActionRow().addComponents(
							new MessageButton()
								.setCustomId(customIdPrefix + "yes")
								.setLabel("Confirm")
								.setStyle("SUCCESS"),
							new MessageButton()
								.setCustomId(customIdPrefix + "no")
								.setLabel("Cancel")
								.setStyle("SECONDARY"),
						),
					],
				});
				// using awaitMessageComponent here because confirming stuff after more then 15 mins is sus
				const nextInteraction = await new Promise(resolve => {
					assert(interaction.channel);
					const collector = interaction.channel.createMessageComponentCollector({
						filter: (i: MessageComponentInteraction) => i.customId.startsWith(customIdPrefix) && i.user.id === interaction.user.id,
						time: 10000,
						max: 1,
					});
					collector.on("end", collected => resolve(collected.first()));
				}) as MessageComponentInteraction | undefined;
				if (nextInteraction == null) {
					throw new InteractionError(`Confirmation timed out`);
				}
				if (nextInteraction.customId.endsWith("no")) {
					throw new InteractionError(`Cancelled request to join`);
				}
				// fail if team is full
				if (team.memberIds.length >= 4) {
					throw new InteractionError(`That team is full :(`);
				}
				// complete command and commit transaction
				await interaction.followUp({ ephemeral, content: `Creating request to join...` });
				await transaction.commit();
				// create message that has buttons for confirming stuff
				const reply = await interaction.channel.send(createTeamJoinRequestOptions(teamName, `<@${callerUser.discordUserId}>`, teamMateDiscordIds.map(i => `<@${i}>`), [], [], true));
				// create delayed interaction info
				const transaction2 = createTransaction(resources);
				((await transaction2.fetch(`/interactions`)).interactionIds ??= []).push(reply.id);
				const info = await transaction2.fetch(`/interaction/${reply.id}`);
				Object.assign(info, {
					id: reply.id,
					type: "teamJoin",
					teamId: team.id,
					waiting: [...team.memberIds],
					approved: [],
					rejected: [],
					caller: callerUser.id,
				});
				await transaction2.commit();
				// enable the buttons
				await reply.edit(createTeamJoinRequestOptions(teamName, `<@${callerUser.discordUserId}>`, teamMateDiscordIds.map(i => `<@${i}>`), [], []));
				return;
			}
			if (subcommandName === "rename") {
				assert(interaction.guild);
				assert(interaction.channel);
				const newTeamName = interaction.options.getString("new-team-name", true);
				// log command and setup transaction
				console.log([ "team", "rename", newTeamName, metadata ]);
				const transaction = createTransaction(resources);
				// create caller
				let callerUser = await findUser(transaction, { discordUserId: interaction.user.id });
				if (callerUser == null) {
					callerUser = await createUser(interaction.guild, transaction, { id: `${interaction.id}${interaction.user.id}`, discordUserId: interaction.user.id });
				}
				// fail if caller isn't in a team
				if (callerUser.teamId == null) {
					throw new InteractionError(`You are not in a team`);
				}
				// fail if name is longer than 32 characters
				if (!(newTeamName.length <= 32)) {
					throw new InteractionError(`The name ${newTeamName} is too long`);
				}
				// fail if another team with same name exists
				if (await findTeam(transaction, { name: newTeamName }) != null) {
					throw new InteractionError(`Team ${newTeamName} already exists`);
				}
				const team = await fetchTeam(transaction, callerUser.teamId);
				const teamMateDiscordUserIds = [];
				for (const memberId of team.memberIds) {
					teamMateDiscordUserIds.push((await fetchUser(transaction, memberId)).discordUserId);
				};
				// complete command and commit transaction
				await interaction.reply({ ephemeral, content: `Creating request to rename team...` });
				await transaction.commit();
				// create message that has buttons for confirming stuff
				const reply = await interaction.channel.send(createTeamRenameRequestOptions(team.name, newTeamName, `<@${callerUser.discordUserId}>`, removeFromArray(teamMateDiscordUserIds, callerUser.discordUserId).map(i => `<@${i}>`), [`<@${callerUser.discordUserId}>`], [], true));
				// create delayed interaction info
				const transaction2 = createTransaction(resources);
				((await transaction2.fetch(`/interactions`)).interactionIds ??= []).push(reply.id);
				const info = await transaction2.fetch(`/interaction/${reply.id}`);
				Object.assign(info, {
					id: reply.id,
					type: "teamRename",
					teamId: team.id,
					waiting: removeFromArray([...team.memberIds], callerUser.id),
					approved: [callerUser.id],
					rejected: [],
					caller: callerUser.id,
					newTeamName,
				});
				await transaction2.commit();
				// enable the buttons
				await reply.edit(createTeamRenameRequestOptions(team.name, newTeamName, `<@${callerUser.discordUserId}>`, removeFromArray(teamMateDiscordUserIds, callerUser.discordUserId).map(i => `<@${i}>`), [`<@${callerUser.discordUserId}>`], []));
				return;
			}
			if (subcommandName === "leave") {
				// log command and setup transaction
				console.log([ "team", "leave", metadata ]);
				const transaction = createTransaction(resources);
				// create caller
				let callerUser = await findUser(transaction, { discordUserId: interaction.user.id });
				if (callerUser == null) {
					callerUser = await createUser(interaction.guild, transaction, { id: `${interaction.id}${interaction.user.id}`, discordUserId: interaction.user.id });
				}
				// fail if caller isn't in a team
				if (callerUser.teamId == null) {
					throw new InteractionError(`You are not in a team`);
				}
				// complete command and commit transaction
				await transaction.commit();
				// create message with further instructions for leaving a team
				await interaction.reply({
					ephemeral,
					content: [
						"Hello! It seems you want to leave your team. ",
						"There are many consequences with leaving a team, such as",
						"not being able to join back, no points being awarded to you after this month, and more.",
						"If you understand these consequences and still wish to continue,",
						"please DM a leader for further action. Thanks :D",
					].join(" "),
				});
				return;
			}
			if (subcommandName === "join-random") {
				// log command and setup transaction
				console.log([ "team", "join-random", metadata ]);
				const transaction = createTransaction(resources);
				// create caller
				let callerUser = await findUser(transaction, { discordUserId: interaction.user.id });
				if (callerUser == null) {
					callerUser = await createUser(interaction.guild, transaction, { id: `${interaction.id}${interaction.user.id}`, discordUserId: interaction.user.id });
				}
				// fail if caller is in a team
				if (callerUser.teamId != null) {
					throw new InteractionError(`You are already in a team`);
				}
				// get joinRandom info
				const joinRandomInfo = await transaction.fetch(`/joinRandom`);
				// if there's another person tryna join a team
				if ("start" in joinRandomInfo) {
					// fail if its the same dude lol
					if (joinRandomInfo.caller === callerUser.id) {
						throw new InteractionError(`You are already waiting to team up`);
					}
					// generate a random team name that doesn't exist
					const teamName = `${Math.floor(Math.random() * 2000)}`
					if (await findTeam(transaction, { name: teamName }) != null)
						throw Error("lol just try again pls: team name collided");
					const otherUser = await fetchUser(transaction, joinRandomInfo.caller);
					// fail if the other dude made a team already
					if (otherUser.teamId == null) {
						// make a team with them and have it be open to others
						const team = await createTeam(interaction.guild, transaction, { id: interaction.id, name: teamName, freeToJoin: true });
						await joinTeam(interaction.guild, transaction, team, otherUser);
						await joinTeam(interaction.guild, transaction, team, callerUser);
						// remove previous message and clear info
						(await (await interaction.guild.channels.fetch(joinRandomInfo.discordChannelId) as TextChannel).messages.fetch(joinRandomInfo.discordMessageId)).delete();
						removeFromArray((await transaction.fetch(`/interactions`)).interactionIds ?? [], joinRandomInfo.interactionId);
						clearObject(await transaction.fetch(`/interaction/${joinRandomInfo.interactionId}`));
						clearObject(joinRandomInfo);
						// complete command
						await transaction.commit();
						await interaction.reply(`Team ${team.name} with members ${await interaction.guild.members.fetch(callerUser.discordUserId)} and ${await interaction.guild.members.fetch(otherUser.discordUserId)} is created`);
						return;
					}
				}
				// create delayed interaction info
				const message = await interaction.channel.send({
					content: `${interaction.user} is looking for a team! Press the button to create a team with them.`,
					components: [
						new MessageActionRow().addComponents(
							new MessageButton()
								.setCustomId("teamUp")
								.setLabel("Team Up")
								.setStyle("SUCCESS"),
							new MessageButton()
								.setCustomId("cancel")
								.setLabel("Cancel")
								.setStyle("SECONDARY"),
						),
					],
				});
				((await transaction.fetch(`/interactions`)).interactionIds ??= []).push(message.id);
				const info = await transaction.fetch(`/interaction/${message.id}`);
				Object.assign(info, {
					id: message.id,
					type: "teamJoinRandom",
					caller: callerUser.id,
				});
				// update joinRandom info
				Object.assign(joinRandomInfo, {
					caller: callerUser.id,
					start: Date.now(),
					discordChannelId: message.channel.id,
					discordMessageId: message.id,
					interactionId: message.id,
				});
				// complete command and commit transaction
				await transaction.commit();
				await interaction.reply({ ephemeral, content: "If you aren't in a team after 30 minutes and haven't cancelled, I'll automatically place you in a team :D (Make sure your DMs are open so I can contact you after 30 mins.)" });
				return;
			}
		}

		if (interaction.commandName === "leaderboard") {
			console.log([ "leaderboard", metadata ]);
			// throttle to 1 update per 5 minutes
			let leaderboard = await resources.fetch(`/leaderboard`);
			if (Date.now() >= (leaderboard.lastUpdatedTimestamp ?? 0) + 5 * 60_000) {
				const transaction = createTransaction(resources);
				const leaderboard = await transaction.fetch(`/leaderboard`);
				leaderboard.lastUpdatedTimestamp = Date.now();
				// get all teams
				const teams = [];
				for (const teamId of (await fetchTeams(transaction)).teamIds ??= [])
					teams.push(await fetchTeam(transaction, teamId));
				// get teams' points
				const teamPoints = new Map();
				for (const team of teams) {
					// get linked stuff
					const submissions = [];
					for (const submissionId of team.submissionIds ??= [])
						submissions.push(await transaction.fetch(`/submissions/${submissionId}`));
					const _challengeIds = new Set();
					for (const submission of submissions)
						for (const challengeId of submission.challengeIds)
							_challengeIds.add(challengeId)
					const challenges = [];
					for (const challengeId of _challengeIds)
						challenges.push(await transaction.fetch(`/challenges/${challengeId}`));
					// calculate stats
					let points = 0;
					for (const challenge of challenges)
						points += challenge.points;
					teamPoints.set(team.id, points);
				}
				// get top teams
				const topTeams = teams.slice();
				topTeams.sort((a, b) => teamPoints.get(b.id) - teamPoints.get(a.id));
				topTeams.splice(5, topTeams.length);
				// update leaderboards
				leaderboard.topTeamIds = topTeams.map(t => t.id);
				leaderboard.topTeamPoints = topTeams.map(t => teamPoints.get(t.id));
				leaderboard.lastUpdatedTimestamp = Date.now();
				// commit
				await transaction.commit();
			}
			// complete
			leaderboard = await resources.fetch(`/leaderboard`);
			const teamLines = [];
			for (let i = 0; i < leaderboard.topTeamIds.length; i++) {
				const team = await fetchTeam(resources, leaderboard.topTeamIds[i]);
				const points = leaderboard.topTeamPoints[i];
				teamLines.push(` - Team ${team.name} (points: ${points}, id: ${team.id})`);
			}
			await interaction.reply({
				ephemeral,
				content: (
					`Leaderboard (last updated: <t:${Math.floor(leaderboard.lastUpdatedTimestamp / 1000)}:R>)\n`
					+ teamLines.map(s => `${s}\n`).join("")
				),
			});
			return;
		}

		if (interaction.commandName === "team-profile") {
			const teamResolvable = interaction.options.getString("team") || undefined;
			console.log([ "team-profile", teamResolvable, metadata ]);
			// get team from team-name or from caller's team if not specified
			let team = undefined;
			if (teamResolvable) {
				// fail if team couldn't be resolved
				team = await fetchTeam(resources, teamResolvable);
				if (!team || team.name == null) {
					const teamByName = await findTeam(resources, { name: teamResolvable });
					if (!teamByName)
						throw new InteractionError(`Could not resolve team ${teamResolvable}`);
					team = teamByName;
				}
				// fail if team isn't on leaderboard and isn't the user's team
				const leaderboard = await resources.fetch(`/leaderboard`);
				if (!(leaderboard.topTeamIds ?? []).includes(team.id)) {
					const user = await findUser(resources, { discordUserId: interaction.user.id });
					if (user && user.teamId !== team.id)
						throw new InteractionError(`Team ${team.name} (id: ${team.id}) is not on the leaderboard`);
				}
			} else {
				// fail if user doesn't exist or doesn't have a team
				const user = await findUser(resources, { discordUserId: interaction.user.id });
				if (!user || user.teamId == null)
					throw new InteractionError(`You are not in a team`);
				team = await fetchTeam(resources, user.teamId);
			}
			// get linked stuff
			const submissions = [];
			for (const submissionId of team.submissionIds ??= [])
				submissions.push(await resources.fetch(`/submissions/${submissionId}`));
			const _challengeIds = new Set();
			for (const submission of submissions)
				for (const challengeId of submission.challengeIds)
					_challengeIds.add(challengeId)
			const challenges = [];
			for (const challengeId of _challengeIds)
				challenges.push(await resources.fetch(`/challenges/${challengeId}`));
			// calculate stats
			let points = 0;
			for (const challenge of challenges)
				points += challenge.points;
			// complete
			await interaction.reply({
				ephemeral,
				content: (
					`Team ${team.name} (id: ${team.id})\n`
					+ ` - Points: ${points}\n`
					+ ` - Challenges: ${challenges.length}\n`
					+ ` - Submissions: ${submissions.length}\n`
				),
			});
			return;
		}

		// fallback when command aint implemented
		console.log(`not implemented: ${interaction.commandName}`);
		await interaction.reply({ ephemeral, content: "not implemented yet lol" });

	} catch (e) {
		let content: string;
		if (!(e instanceof InteractionError)) {
			console.error(e);
			content = `Oops, an internal error occurred: ${e}`;
		} else {
			content = e.message;
		}
		try {
			if (!interaction.replied) {
				await interaction.reply({ ephemeral, content });
			} else {
				await interaction.followUp({ ephemeral, content });
			}
		} catch (e) {
			console.log(`Couldn't send last error: ${e}`);
		}
	} finally {
		running = false;
	}
});

client.login(process.env.BOT_TOKEN);
