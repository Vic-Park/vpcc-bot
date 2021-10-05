# idea:
 - we have a key value store / database / thing
 - keys should look like resources (/users, /user/69, etc)
 - values are lists of "events" with a timestamp, key, and value
    - timestamp is from Date.now()
    - key is some property to update and is a string
    - value is the data to add and is an object
       - usually has a human readable reason property
    - aside: could have a version in the future (default is version 1)
    - to get the current state, just loop through them lol
    - to get a history of events, just loop through them lol
    - just loop through them lol
    - we can worry about performance later

## /users

```json
[
	// new user
	{
		timestamp: number,
		key: "user",
		value: {
			userId: userId,
			reason: string,
		},
	},
]
```

## /user/<userId>

```json
[
	// update user's team
	{
		timestamp: number,
		key: "team",
		value: {
			teamId: teamId,
			reason: string,
		},
	},
	// add medal
	{
		timestamp: number,
		key: "medals",
		value: {
			type: "gold" | "silver" | "bronze",
			reason: string,
		},
	},
]
```

## /teams

```json
[
	// new team
	{
		timestamp: number,
		key: "teams",
		value: {
			teamId: teamId,
			reason: string,
		},
	},
]
```

## /team/<teamId>

```json
[
	// add points
	{
		timestamp: number,
		key: "points",
		value: {
			points: number,
			reason: string,
		},
	},
	// update name
	{
		timestamp: number,
		key: "name",
		value: {
			name: string,
			reason: string,
		},
	},
	// update corresponding discord role
	{
		timestamp: number,
		key: "role",
		value: {
			roleId: discordRoleId,
			reason: string,
		},
	},
	// whether people can join
	{
		timestamp: number,
		key: "active",
		value: {
			active: boolean,
			reason: string,
		},
	},
]
```
