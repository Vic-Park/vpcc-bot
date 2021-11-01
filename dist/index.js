"use strict";
// Runs the VPCC-Bot
var __assign = (this && this.__assign) || function () {
    __assign = Object.assign || function(t) {
        for (var s, i = 1, n = arguments.length; i < n; i++) {
            s = arguments[i];
            for (var p in s) if (Object.prototype.hasOwnProperty.call(s, p))
                t[p] = s[p];
        }
        return t;
    };
    return __assign.apply(this, arguments);
};
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __generator = (this && this.__generator) || function (thisArg, body) {
    var _ = { label: 0, sent: function() { if (t[0] & 1) throw t[1]; return t[1]; }, trys: [], ops: [] }, f, y, t, g;
    return g = { next: verb(0), "throw": verb(1), "return": verb(2) }, typeof Symbol === "function" && (g[Symbol.iterator] = function() { return this; }), g;
    function verb(n) { return function (v) { return step([n, v]); }; }
    function step(op) {
        if (f) throw new TypeError("Generator is already executing.");
        while (_) try {
            if (f = 1, y && (t = op[0] & 2 ? y["return"] : op[0] ? y["throw"] || ((t = y["return"]) && t.call(y), 0) : y.next) && !(t = t.call(y, op[1])).done) return t;
            if (y = 0, t) op = [op[0] & 2, t.value];
            switch (op[0]) {
                case 0: case 1: t = op; break;
                case 4: _.label++; return { value: op[1], done: false };
                case 5: _.label++; y = op[1]; op = [0]; continue;
                case 7: op = _.ops.pop(); _.trys.pop(); continue;
                default:
                    if (!(t = _.trys, t = t.length > 0 && t[t.length - 1]) && (op[0] === 6 || op[0] === 2)) { _ = 0; continue; }
                    if (op[0] === 3 && (!t || (op[1] > t[0] && op[1] < t[3]))) { _.label = op[1]; break; }
                    if (op[0] === 6 && _.label < t[1]) { _.label = t[1]; t = op; break; }
                    if (t && _.label < t[2]) { _.label = t[2]; _.ops.push(op); break; }
                    if (t[2]) _.ops.pop();
                    _.trys.pop(); continue;
            }
            op = body.call(thisArg, _);
        } catch (e) { op = [6, e]; y = 0; } finally { f = t = 0; }
        if (op[0] & 5) throw op[1]; return { value: op[0] ? op[1] : void 0, done: true };
    }
};
var __rest = (this && this.__rest) || function (s, e) {
    var t = {};
    for (var p in s) if (Object.prototype.hasOwnProperty.call(s, p) && e.indexOf(p) < 0)
        t[p] = s[p];
    if (s != null && typeof Object.getOwnPropertySymbols === "function")
        for (var i = 0, p = Object.getOwnPropertySymbols(s); i < p.length; i++) {
            if (e.indexOf(p[i]) < 0 && Object.prototype.propertyIsEnumerable.call(s, p[i]))
                t[p[i]] = s[p[i]];
        }
    return t;
};
var __values = (this && this.__values) || function(o) {
    var s = typeof Symbol === "function" && Symbol.iterator, m = s && o[s], i = 0;
    if (m) return m.call(o);
    if (o && typeof o.length === "number") return {
        next: function () {
            if (o && i >= o.length) o = void 0;
            return { value: o && o[i++], done: !o };
        }
    };
    throw new TypeError(s ? "Object is not iterable." : "Symbol.iterator is not defined.");
};
var __read = (this && this.__read) || function (o, n) {
    var m = typeof Symbol === "function" && o[Symbol.iterator];
    if (!m) return o;
    var i = m.call(o), r, ar = [], e;
    try {
        while ((n === void 0 || n-- > 0) && !(r = i.next()).done) ar.push(r.value);
    }
    catch (error) { e = { error: error }; }
    finally {
        try {
            if (r && !r.done && (m = i["return"])) m.call(i);
        }
        finally { if (e) throw e.error; }
    }
    return ar;
};
var __spreadArray = (this && this.__spreadArray) || function (to, from, pack) {
    if (pack || arguments.length === 2) for (var i = 0, l = from.length, ar; i < l; i++) {
        if (ar || !(i in from)) {
            if (!ar) ar = Array.prototype.slice.call(from, 0, i);
            ar[i] = from[i];
        }
    }
    return to.concat(ar || Array.prototype.slice.call(from));
};
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
var node_cache_1 = __importDefault(require("node-cache"));
var keyv_1 = __importDefault(require("keyv"));
var keyv_file_1 = require("keyv-file");
var discord_js_1 = require("discord.js");
var assert_1 = __importDefault(require("assert"));
require("dotenv").config();
var client = new discord_js_1.Client({ intents: [discord_js_1.Intents.FLAGS.GUILDS, discord_js_1.Intents.FLAGS.GUILD_MEMBERS], rejectOnRateLimit: function () { return true; } });
client.on("ready", function () {
    console.log("Logged in as " + client.user.tag);
});
function sleep(milliseconds) {
    return new Promise(function (resolve) { return setTimeout(resolve, milliseconds); });
}
function assert(thing) {
    (0, assert_1.default)(thing != null);
}
// keyv-file based store (will be upgraded to use replit's built in key value store later)
var Store = /** @class */ (function () {
    function Store(keyv) {
        this.keyv = keyv;
    }
    ;
    Store.prototype.get = function (resource) {
        var _a;
        return __awaiter(this, void 0, void 0, function () {
            return __generator(this, function (_b) {
                switch (_b.label) {
                    case 0: return [4 /*yield*/, this.keyv.get(resource)];
                    case 1: return [2 /*return*/, (_a = (_b.sent())) !== null && _a !== void 0 ? _a : {}];
                }
            });
        });
    };
    ;
    Store.prototype.set = function (resource, data) {
        return __awaiter(this, void 0, void 0, function () {
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        if (!(JSON.stringify(data) === "{}")) return [3 /*break*/, 2];
                        return [4 /*yield*/, this.keyv.delete(resource)];
                    case 1:
                        _a.sent();
                        return [3 /*break*/, 4];
                    case 2: return [4 /*yield*/, this.keyv.set(resource, data)];
                    case 3:
                        _a.sent();
                        _a.label = 4;
                    case 4: return [2 /*return*/];
                }
            });
        });
    };
    ;
    Store.prototype.modify = function (resource, callback) {
        return __awaiter(this, void 0, void 0, function () {
            var data;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0: return [4 /*yield*/, this.get(resource)];
                    case 1:
                        data = _a.sent();
                        return [4 /*yield*/, callback(data)];
                    case 2:
                        _a.sent();
                        return [4 /*yield*/, this.set(resource, data)];
                    case 3:
                        _a.sent();
                        return [2 /*return*/];
                }
            });
        });
    };
    ;
    return Store;
}());
function createStore(keyv) {
    return new Store(keyv);
}
var store = createStore(new keyv_1.default({
    store: new keyv_file_1.KeyvFile({
        filename: "store.json",
    }),
}));
// Helper function to remove an element from an array
function removeFromArray(array, element) {
    var index = array.lastIndexOf(element);
    if (index !== -1)
        array.splice(index, 1);
    return array;
}
// Asynchronous version of Array.prototype.find
function findPredicate(array, predicate) {
    return __awaiter(this, void 0, void 0, function () {
        var i;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    i = 0;
                    _a.label = 1;
                case 1:
                    if (!(i < array.length)) return [3 /*break*/, 4];
                    return [4 /*yield*/, predicate(array[i], i, array)];
                case 2:
                    if (_a.sent()) {
                        return [2 /*return*/, array[i]];
                    }
                    _a.label = 3;
                case 3:
                    i++;
                    return [3 /*break*/, 1];
                case 4: return [2 /*return*/, undefined];
            }
        });
    });
}
var Resources = /** @class */ (function () {
    function Resources(store) {
        this.store = store;
        this.cache = new node_cache_1.default();
        this.resourceCache = new WeakMap();
    }
    ;
    // call with a resource string or an object with { resource, force = false, cache = true }
    Resources.prototype.fetch = function (options) {
        var _a, _b;
        return __awaiter(this, void 0, void 0, function () {
            var obj;
            return __generator(this, function (_c) {
                switch (_c.label) {
                    case 0:
                        if (typeof options === "string")
                            options = { resource: options };
                        obj = undefined;
                        if (!((_a = options.force) !== null && _a !== void 0 ? _a : false))
                            obj = this.cache.get(options.resource);
                        if (!(obj == null)) return [3 /*break*/, 2];
                        return [4 /*yield*/, this.store.get(options.resource)];
                    case 1:
                        obj = _c.sent();
                        if ((_b = options.cache) !== null && _b !== void 0 ? _b : true)
                            this.cache.set(options.resource, obj);
                        _c.label = 2;
                    case 2:
                        this.resourceCache.set(obj, options.resource);
                        return [2 /*return*/, obj];
                }
            });
        });
    };
    ;
    // update the resource object to the store
    Resources.prototype.push = function (obj) {
        return __awaiter(this, void 0, void 0, function () {
            var resource;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        resource = this.resourceCache.get(obj);
                        if (resource == null)
                            return [2 /*return*/];
                        this.cache.del(resource);
                        return [4 /*yield*/, this.store.set(resource, obj)];
                    case 1: return [2 /*return*/, _a.sent()];
                }
            });
        });
    };
    ;
    // invalidate the cache
    Resources.prototype.invalidate = function () {
        return __awaiter(this, void 0, void 0, function () {
            return __generator(this, function (_a) {
                this.cache.flushAll();
                return [2 /*return*/];
            });
        });
    };
    ;
    return Resources;
}());
function createResources(store) {
    return new Resources(store);
}
var resources = createResources(store);
// creates a "transaction" that updates all changed values at the end
var Transaction = /** @class */ (function () {
    function Transaction(resources) {
        this.resources = resources;
        this.data = {};
    }
    ;
    // call with a resource string or an object with resources.fetch.options
    Transaction.prototype.fetch = function (options) {
        var _a;
        var _b, _c;
        return __awaiter(this, void 0, void 0, function () {
            var _d;
            return __generator(this, function (_e) {
                switch (_e.label) {
                    case 0:
                        if (typeof options === "string")
                            options = { resource: options };
                        if (!((_a = (_b = this.data)[_c = options.resource]) !== null && _a !== void 0)) return [3 /*break*/, 1];
                        _d = _a;
                        return [3 /*break*/, 3];
                    case 1: return [4 /*yield*/, this.resources.fetch(options)];
                    case 2:
                        _d = (_b[_c] = _e.sent());
                        _e.label = 3;
                    case 3: return [2 /*return*/, _d];
                }
            });
        });
    };
    ;
    // pushes all changes and clears data
    Transaction.prototype.commit = function () {
        return __awaiter(this, void 0, void 0, function () {
            var _a, _b, _i, resource;
            return __generator(this, function (_c) {
                switch (_c.label) {
                    case 0:
                        _a = [];
                        for (_b in this.data)
                            _a.push(_b);
                        _i = 0;
                        _c.label = 1;
                    case 1:
                        if (!(_i < _a.length)) return [3 /*break*/, 4];
                        resource = _a[_i];
                        // future: check if something actually changed before pushing
                        return [4 /*yield*/, this.resources.push(this.data[resource])];
                    case 2:
                        // future: check if something actually changed before pushing
                        _c.sent();
                        delete this.data[resource];
                        _c.label = 3;
                    case 3:
                        _i++;
                        return [3 /*break*/, 1];
                    case 4: return [2 /*return*/];
                }
            });
        });
    };
    ;
    return Transaction;
}());
function createTransaction(resources) {
    return new Transaction(resources);
}
var running = false;
// deletes all values from an object
function clearObject(obj) {
    for (var name in obj)
        delete obj[name];
}
// get users info
function fetchUsers(resources) {
    var _a;
    return __awaiter(this, void 0, void 0, function () {
        var users;
        return __generator(this, function (_b) {
            switch (_b.label) {
                case 0: return [4 /*yield*/, resources.fetch("/users")];
                case 1:
                    users = _b.sent();
                    (_a = users.userIds) !== null && _a !== void 0 ? _a : (users.userIds = []);
                    return [2 /*return*/, users];
            }
        });
    });
}
// get teams info
function fetchTeams(resources) {
    var _a;
    return __awaiter(this, void 0, void 0, function () {
        var teams;
        return __generator(this, function (_b) {
            switch (_b.label) {
                case 0: return [4 /*yield*/, resources.fetch("/teams")];
                case 1:
                    teams = _b.sent();
                    (_a = teams.teamIds) !== null && _a !== void 0 ? _a : (teams.teamIds = []);
                    return [2 /*return*/, teams];
            }
        });
    });
}
// Typed Object.keys
function objectKeys(thing) {
    var _a, _b, _i, name;
    return __generator(this, function (_c) {
        switch (_c.label) {
            case 0:
                _a = [];
                for (_b in thing)
                    _a.push(_b);
                _i = 0;
                _c.label = 1;
            case 1:
                if (!(_i < _a.length)) return [3 /*break*/, 4];
                name = _a[_i];
                return [4 /*yield*/, name];
            case 2:
                _c.sent();
                _c.label = 3;
            case 3:
                _i++;
                return [3 /*break*/, 1];
            case 4: return [2 /*return*/];
        }
    });
}
// find user with matching requirements
function findUser(resources, requirements) {
    return __awaiter(this, void 0, void 0, function () {
        var _a, _b, userId, user, _c, _d, name, e_1_1;
        var e_1, _e, e_2, _f;
        return __generator(this, function (_g) {
            switch (_g.label) {
                case 0:
                    _g.trys.push([0, 6, 7, 8]);
                    return [4 /*yield*/, fetchUsers(resources)];
                case 1:
                    _a = __values.apply(void 0, [(_g.sent()).userIds]), _b = _a.next();
                    _g.label = 2;
                case 2:
                    if (!!_b.done) return [3 /*break*/, 5];
                    userId = _b.value;
                    return [4 /*yield*/, fetchUser(resources, userId)];
                case 3:
                    user = _g.sent();
                    try {
                        for (_c = (e_2 = void 0, __values(objectKeys(requirements))), _d = _c.next(); !_d.done; _d = _c.next()) {
                            name = _d.value;
                            if (requirements[name] !== user[name])
                                return [3 /*break*/, 4];
                        }
                    }
                    catch (e_2_1) { e_2 = { error: e_2_1 }; }
                    finally {
                        try {
                            if (_d && !_d.done && (_f = _c.return)) _f.call(_c);
                        }
                        finally { if (e_2) throw e_2.error; }
                    }
                    return [2 /*return*/, user];
                case 4:
                    _b = _a.next();
                    return [3 /*break*/, 2];
                case 5: return [3 /*break*/, 8];
                case 6:
                    e_1_1 = _g.sent();
                    e_1 = { error: e_1_1 };
                    return [3 /*break*/, 8];
                case 7:
                    try {
                        if (_b && !_b.done && (_e = _a.return)) _e.call(_a);
                    }
                    finally { if (e_1) throw e_1.error; }
                    return [7 /*endfinally*/];
                case 8: return [2 /*return*/, undefined];
            }
        });
    });
}
// find team with matching requirements
function findTeam(resources, requirements) {
    return __awaiter(this, void 0, void 0, function () {
        var _a, _b, teamId, team, _c, _d, name, e_3_1;
        var e_3, _e, e_4, _f;
        return __generator(this, function (_g) {
            switch (_g.label) {
                case 0:
                    _g.trys.push([0, 6, 7, 8]);
                    return [4 /*yield*/, fetchTeams(resources)];
                case 1:
                    _a = __values.apply(void 0, [(_g.sent()).teamIds]), _b = _a.next();
                    _g.label = 2;
                case 2:
                    if (!!_b.done) return [3 /*break*/, 5];
                    teamId = _b.value;
                    return [4 /*yield*/, fetchTeam(resources, teamId)];
                case 3:
                    team = _g.sent();
                    try {
                        for (_c = (e_4 = void 0, __values(objectKeys(requirements))), _d = _c.next(); !_d.done; _d = _c.next()) {
                            name = _d.value;
                            if (requirements[name] !== team[name])
                                return [3 /*break*/, 4];
                        }
                    }
                    catch (e_4_1) { e_4 = { error: e_4_1 }; }
                    finally {
                        try {
                            if (_d && !_d.done && (_f = _c.return)) _f.call(_c);
                        }
                        finally { if (e_4) throw e_4.error; }
                    }
                    return [2 /*return*/, team];
                case 4:
                    _b = _a.next();
                    return [3 /*break*/, 2];
                case 5: return [3 /*break*/, 8];
                case 6:
                    e_3_1 = _g.sent();
                    e_3 = { error: e_3_1 };
                    return [3 /*break*/, 8];
                case 7:
                    try {
                        if (_b && !_b.done && (_e = _a.return)) _e.call(_a);
                    }
                    finally { if (e_3) throw e_3.error; }
                    return [7 /*endfinally*/];
                case 8: return [2 /*return*/, undefined];
            }
        });
    });
}
// find user with id
function fetchUser(resources, userId) {
    var _a;
    return __awaiter(this, void 0, void 0, function () {
        var user;
        return __generator(this, function (_b) {
            switch (_b.label) {
                case 0: return [4 /*yield*/, resources.fetch("/user/" + userId)];
                case 1:
                    user = _b.sent();
                    (_a = user.id) !== null && _a !== void 0 ? _a : (user.id = userId);
                    return [2 /*return*/, user];
            }
        });
    });
}
// find teamId with id
function fetchTeam(resources, teamId) {
    var _a;
    return __awaiter(this, void 0, void 0, function () {
        var team;
        return __generator(this, function (_b) {
            switch (_b.label) {
                case 0: return [4 /*yield*/, resources.fetch("/team/" + teamId)];
                case 1:
                    team = _b.sent();
                    (_a = team.id) !== null && _a !== void 0 ? _a : (team.id = teamId);
                    return [2 /*return*/, team];
            }
        });
    });
}
function createUser(_guild, transaction, _a) {
    var _b;
    var id = _a.id, properties = __rest(_a, ["id"]);
    return __awaiter(this, void 0, void 0, function () {
        var users, user;
        return __generator(this, function (_c) {
            switch (_c.label) {
                case 0: return [4 /*yield*/, fetchUsers(transaction)];
                case 1:
                    users = _c.sent();
                    return [4 /*yield*/, fetchUser(transaction, id)];
                case 2:
                    user = _c.sent();
                    // create user with properties
                    Object.assign(user, properties);
                    ((_b = users.userIds) !== null && _b !== void 0 ? _b : (users.userIds = [])).push(user.id);
                    return [2 /*return*/, user];
            }
        });
    });
}
function createTeam(guild, transaction, _a) {
    var _b, _c;
    var id = _a.id, properties = __rest(_a, ["id"]);
    return __awaiter(this, void 0, void 0, function () {
        var teams, team, role, supervisorRole, teamCategory, channelOptions, textChannel, voiceChannel;
        return __generator(this, function (_d) {
            switch (_d.label) {
                case 0: return [4 /*yield*/, fetchTeams(transaction)];
                case 1:
                    teams = _d.sent();
                    return [4 /*yield*/, fetchTeam(transaction, id)];
                case 2:
                    team = _d.sent();
                    // create team with properties
                    Object.assign(team, properties);
                    ((_b = teams.teamIds) !== null && _b !== void 0 ? _b : (teams.teamIds = [])).push(team.id);
                    (_c = team.memberIds) !== null && _c !== void 0 ? _c : (team.memberIds = []);
                    return [4 /*yield*/, guild.roles.create({ name: "Team " + team.name })];
                case 3:
                    role = _d.sent();
                    team.discordRoleId = role.id;
                    return [4 /*yield*/, guild.roles.fetch()];
                case 4:
                    supervisorRole = (_d.sent()).find(function (role) { return role.name.toLowerCase() === "supervisor"; });
                    return [4 /*yield*/, guild.channels.fetch()];
                case 5:
                    teamCategory = (_d.sent()).find(function (channel) { return (channel instanceof discord_js_1.CategoryChannel
                        && channel.name.toLowerCase() === "team"); });
                    if (teamCategory == null) {
                        throw Error("team category not found");
                    }
                    channelOptions = {
                        parent: teamCategory,
                        permissionOverwrites: [
                            { id: guild.roles.everyone, deny: [discord_js_1.Permissions.FLAGS.VIEW_CHANNEL] },
                            { id: role, allow: [discord_js_1.Permissions.FLAGS.VIEW_CHANNEL] },
                        ],
                    };
                    if (supervisorRole != null) {
                        channelOptions.permissionOverwrites.push({ id: supervisorRole, allow: [discord_js_1.Permissions.FLAGS.VIEW_CHANNEL] });
                    }
                    else {
                        console.log("sus no supervisor role");
                    }
                    return [4 /*yield*/, guild.channels.create("Team " + team.name, channelOptions)];
                case 6:
                    textChannel = _d.sent();
                    return [4 /*yield*/, guild.channels.create("Team " + team.name, __assign({ type: "GUILD_VOICE" }, channelOptions))];
                case 7:
                    voiceChannel = _d.sent();
                    team.discordTextChannelId = textChannel.id;
                    team.discordVoiceChannelId = voiceChannel.id;
                    return [2 /*return*/, team];
            }
        });
    });
}
function joinTeam(guild, _transaction, team, user) {
    var _a;
    return __awaiter(this, void 0, void 0, function () {
        var discordMember, role;
        return __generator(this, function (_b) {
            switch (_b.label) {
                case 0:
                    // join team
                    ((_a = team.memberIds) !== null && _a !== void 0 ? _a : (team.memberIds = [])).push(user.id);
                    user.teamId = team.id;
                    return [4 /*yield*/, guild.members.fetch(user.discordUserId)];
                case 1:
                    discordMember = _b.sent();
                    return [4 /*yield*/, guild.roles.fetch(team.discordRoleId)];
                case 2:
                    role = _b.sent();
                    assert(role);
                    return [4 /*yield*/, discordMember.roles.add(role)];
                case 3:
                    _b.sent();
                    return [2 /*return*/];
            }
        });
    });
}
function renameTeam(guild, _transaction, team, name) {
    return __awaiter(this, void 0, void 0, function () {
        var textChannel, voiceChannel, role;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    // rename team
                    team.name = name;
                    // rename team channels
                    assert(team.discordTextChannelId);
                    assert(team.discordVoiceChannelId);
                    return [4 /*yield*/, guild.channels.fetch(team.discordTextChannelId)];
                case 1:
                    textChannel = _a.sent();
                    return [4 /*yield*/, guild.channels.fetch(team.discordVoiceChannelId)];
                case 2:
                    voiceChannel = _a.sent();
                    assert(textChannel);
                    assert(voiceChannel);
                    return [4 /*yield*/, textChannel.edit({ name: "Team " + name })];
                case 3:
                    _a.sent();
                    return [4 /*yield*/, voiceChannel.edit({ name: "Team " + name })];
                case 4:
                    _a.sent();
                    // rename role
                    assert(team.discordRoleId);
                    return [4 /*yield*/, guild.roles.fetch(team.discordRoleId)];
                case 5:
                    role = _a.sent();
                    assert(role);
                    return [4 /*yield*/, role.edit({ name: "Team " + name })];
                case 6:
                    _a.sent();
                    return [2 /*return*/];
            }
        });
    });
}
function leaveTeam(guild, transaction, user) {
    var _a, _b;
    return __awaiter(this, void 0, void 0, function () {
        var team, discordMember, role;
        return __generator(this, function (_c) {
            switch (_c.label) {
                case 0:
                    assert(user.teamId);
                    return [4 /*yield*/, fetchTeam(transaction, user.teamId)];
                case 1:
                    team = _c.sent();
                    (_a = team.id) !== null && _a !== void 0 ? _a : (team.id = user.teamId);
                    return [4 /*yield*/, guild.members.fetch(user.discordUserId)];
                case 2:
                    discordMember = _c.sent();
                    assert(team.discordRoleId);
                    return [4 /*yield*/, guild.roles.fetch(team.discordRoleId)];
                case 3:
                    role = _c.sent();
                    assert(role);
                    return [4 /*yield*/, discordMember.roles.remove(role)];
                case 4:
                    _c.sent();
                    // leave team
                    removeFromArray(((_b = team.memberIds) !== null && _b !== void 0 ? _b : (team.memberIds = [])), user.id);
                    user.teamId = undefined;
                    return [2 /*return*/];
            }
        });
    });
}
function destroyTeam(guild, transaction, team) {
    var _a;
    return __awaiter(this, void 0, void 0, function () {
        var teams, textChannel, voiceChannel, role;
        return __generator(this, function (_b) {
            switch (_b.label) {
                case 0: return [4 /*yield*/, fetchTeams(transaction)];
                case 1:
                    teams = _b.sent();
                    // remove team channels
                    assert(team.discordTextChannelId);
                    assert(team.discordVoiceChannelId);
                    return [4 /*yield*/, guild.channels.fetch(team.discordTextChannelId)];
                case 2:
                    textChannel = _b.sent();
                    return [4 /*yield*/, guild.channels.fetch(team.discordVoiceChannelId)];
                case 3:
                    voiceChannel = _b.sent();
                    assert(textChannel);
                    assert(voiceChannel);
                    return [4 /*yield*/, textChannel.delete()];
                case 4:
                    _b.sent();
                    return [4 /*yield*/, voiceChannel.delete()];
                case 5:
                    _b.sent();
                    // remove team role
                    assert(team.discordRoleId);
                    return [4 /*yield*/, guild.roles.fetch(team.discordRoleId)];
                case 6:
                    role = _b.sent();
                    assert(role);
                    return [4 /*yield*/, role.delete()];
                case 7:
                    _b.sent();
                    // remove team
                    removeFromArray(((_a = teams.teamIds) !== null && _a !== void 0 ? _a : (teams.teamIds = [])), team.id);
                    clearObject(team);
                    return [2 /*return*/];
            }
        });
    });
}
function checkJoinRandom() {
    var _a, _b, _c;
    return __awaiter(this, void 0, void 0, function () {
        var guild, transaction, joinRandomInfo, caller, bestTeam, _d, _e, teamId, team, e_5_1, _f, _g, channel, _h, _j, _k, _l;
        var e_5, _m;
        return __generator(this, function (_o) {
            switch (_o.label) {
                case 0: return [4 /*yield*/, client.guilds.fetch(process.env.GUILD_ID)];
                case 1:
                    guild = _o.sent();
                    console.log("running check on joinRandom");
                    transaction = createTransaction(resources);
                    return [4 /*yield*/, transaction.fetch("/joinRandom")];
                case 2:
                    joinRandomInfo = _o.sent();
                    if (joinRandomInfo.start == null || joinRandomInfo.start + 30 * 60000 > Date.now())
                        return [2 /*return*/];
                    console.log("attempting to add user");
                    return [4 /*yield*/, fetchUser(transaction, joinRandomInfo.caller)];
                case 3:
                    caller = _o.sent();
                    bestTeam = undefined;
                    if (!(caller.teamId == null)) return [3 /*break*/, 23];
                    _o.label = 4;
                case 4:
                    _o.trys.push([4, 10, 11, 12]);
                    return [4 /*yield*/, fetchTeams(transaction)];
                case 5:
                    _d = __values.apply(void 0, [(_a = (_o.sent()).teamIds) !== null && _a !== void 0 ? _a : []]), _e = _d.next();
                    _o.label = 6;
                case 6:
                    if (!!_e.done) return [3 /*break*/, 9];
                    teamId = _e.value;
                    return [4 /*yield*/, fetchTeam(transaction, teamId)];
                case 7:
                    team = _o.sent();
                    if (!team.freeToJoin)
                        return [3 /*break*/, 8];
                    if (team.memberIds.length >= 4)
                        return [3 /*break*/, 8];
                    if (!bestTeam ? true : team.memberIds.length < bestTeam.memberIds.length) {
                        bestTeam = team;
                    }
                    _o.label = 8;
                case 8:
                    _e = _d.next();
                    return [3 /*break*/, 6];
                case 9: return [3 /*break*/, 12];
                case 10:
                    e_5_1 = _o.sent();
                    e_5 = { error: e_5_1 };
                    return [3 /*break*/, 12];
                case 11:
                    try {
                        if (_e && !_e.done && (_m = _d.return)) _m.call(_d);
                    }
                    finally { if (e_5) throw e_5.error; }
                    return [7 /*endfinally*/];
                case 12:
                    if (!(bestTeam == null)) return [3 /*break*/, 21];
                    return [4 /*yield*/, guild.channels.fetch(joinRandomInfo.discordChannelId)];
                case 13: return [4 /*yield*/, (_o.sent()).messages.fetch(joinRandomInfo.discordMessageId)];
                case 14:
                    (_o.sent()).delete();
                    _f = removeFromArray;
                    return [4 /*yield*/, transaction.fetch("/interactions")];
                case 15:
                    _f.apply(void 0, [(_b = (_o.sent()).interactionIds) !== null && _b !== void 0 ? _b : [], joinRandomInfo.interactionId]);
                    _g = clearObject;
                    return [4 /*yield*/, transaction.fetch("/interaction/" + joinRandomInfo.interactionId)];
                case 16:
                    _g.apply(void 0, [_o.sent()]);
                    clearObject(joinRandomInfo);
                    return [4 /*yield*/, transaction.commit()];
                case 17:
                    _o.sent();
                    return [4 /*yield*/, guild.members.fetch(caller.discordUserId)];
                case 18: return [4 /*yield*/, (_o.sent()).createDM()];
                case 19: return [4 /*yield*/, (_o.sent()).send("30 minutes passed but no free to join teams were available :(")];
                case 20:
                    _o.sent();
                    return [2 /*return*/];
                case 21: 
                // join the team and clear info
                return [4 /*yield*/, joinTeam(guild, transaction, bestTeam, caller)];
                case 22:
                    // join the team and clear info
                    _o.sent();
                    _o.label = 23;
                case 23: return [4 /*yield*/, guild.channels.fetch(joinRandomInfo.discordChannelId)];
                case 24:
                    channel = _o.sent();
                    return [4 /*yield*/, channel.messages.fetch(joinRandomInfo.discordMessageId)];
                case 25:
                    (_o.sent()).delete();
                    _h = removeFromArray;
                    return [4 /*yield*/, transaction.fetch("/interactions")];
                case 26:
                    _h.apply(void 0, [(_c = (_o.sent()).interactionIds) !== null && _c !== void 0 ? _c : [], joinRandomInfo.interactionId]);
                    _j = clearObject;
                    return [4 /*yield*/, transaction.fetch("/interaction/" + joinRandomInfo.interactionId)];
                case 27:
                    _j.apply(void 0, [_o.sent()]);
                    clearObject(joinRandomInfo);
                    return [4 /*yield*/, transaction.commit()];
                case 28:
                    _o.sent();
                    if (!(bestTeam != null)) return [3 /*break*/, 31];
                    _l = (_k = channel).send;
                    return [4 /*yield*/, guild.members.fetch(caller.discordUserId)];
                case 29: return [4 /*yield*/, _l.apply(_k, [(_o.sent()) + " joined team " + bestTeam.name])];
                case 30:
                    _o.sent();
                    _o.label = 31;
                case 31: return [2 /*return*/];
            }
        });
    });
}
client.once("ready", function () { return __awaiter(void 0, void 0, void 0, function () {
    return __generator(this, function (_a) {
        switch (_a.label) {
            case 0:
                if (!true) return [3 /*break*/, 2];
                return [4 /*yield*/, Promise.all([
                        checkJoinRandom(),
                        sleep(60000),
                    ])];
            case 1:
                _a.sent();
                return [3 /*break*/, 0];
            case 2: return [2 /*return*/];
        }
    });
}); });
var teamFunctions = {
    create: function (interaction, metadata) {
        var _a;
        var _b;
        return __awaiter(this, void 0, void 0, function () {
            var teamName, member1, member2, member3, teamMates, _c, _d, _e, _f, transaction, caller, _g, _h, member, e_6_1, teamMates_1, teamMates_1_1, teamMate, e_7_1, previousMessage, message, info, _j, _k, _l;
            var e_6, _m, e_7, _o, _p;
            var _this = this;
            return __generator(this, function (_q) {
                switch (_q.label) {
                    case 0:
                        assert(interaction.guild);
                        assert(interaction.channel);
                        teamName = interaction.options.getString("team-name", true);
                        return [4 /*yield*/, interaction.guild.members.fetch(interaction.options.getUser("member1", true))];
                    case 1:
                        member1 = _q.sent();
                        member2 = interaction.options.getUser("member2", false);
                        member3 = interaction.options.getUser("member3", false);
                        teamMates = [member1];
                        if (!(member2 != null)) return [3 /*break*/, 3];
                        _d = (_c = teamMates).push;
                        return [4 /*yield*/, interaction.guild.members.fetch(member2)];
                    case 2:
                        _d.apply(_c, [_q.sent()]);
                        _q.label = 3;
                    case 3:
                        if (!(member3 != null)) return [3 /*break*/, 5];
                        _f = (_e = teamMates).push;
                        return [4 /*yield*/, interaction.guild.members.fetch(member3)];
                    case 4:
                        _f.apply(_e, [_q.sent()]);
                        _q.label = 5;
                    case 5:
                        // log command and setup transaction
                        console.log(["team", "create", teamName, teamMates, metadata]);
                        transaction = createTransaction(resources);
                        caller = interaction.user;
                        return [4 /*yield*/, findTeam(transaction, { name: teamName })];
                    case 6:
                        if (!((_q.sent()) != null)) return [3 /*break*/, 8];
                        return [4 /*yield*/, interaction.editReply("Team called " + teamName + " already exists")];
                    case 7:
                        _q.sent();
                        return [2 /*return*/];
                    case 8:
                        if (!!(teamName.length <= 32)) return [3 /*break*/, 10];
                        return [4 /*yield*/, interaction.editReply("Team name " + teamName + " too long")];
                    case 9:
                        _q.sent();
                        return [2 /*return*/];
                    case 10:
                        if (!teamMates.some(function (member) { return caller.id === member.id; })) return [3 /*break*/, 12];
                        return [4 /*yield*/, interaction.editReply("Caller was specified again as a team mate")];
                    case 11:
                        _q.sent();
                        return [2 /*return*/];
                    case 12:
                        if (!((new Set(teamMates.map(function (member) { return member.id; }))).size !== teamMates.length)) return [3 /*break*/, 14];
                        return [4 /*yield*/, interaction.editReply("A team mate was repeated in the command")];
                    case 13:
                        _q.sent();
                        return [2 /*return*/];
                    case 14:
                        _q.trys.push([14, 20, 21, 22]);
                        _g = __values(__spreadArray([caller], __read(teamMates), false)), _h = _g.next();
                        _q.label = 15;
                    case 15:
                        if (!!_h.done) return [3 /*break*/, 19];
                        member = _h.value;
                        return [4 /*yield*/, findUser(transaction, { discordUserId: member.id })];
                    case 16:
                        if (!((_q.sent()) == null)) return [3 /*break*/, 18];
                        return [4 /*yield*/, createUser(interaction.guild, transaction, { id: "" + interaction.id + member.id, discordUserId: member.id })];
                    case 17:
                        _q.sent();
                        _q.label = 18;
                    case 18:
                        _h = _g.next();
                        return [3 /*break*/, 15];
                    case 19: return [3 /*break*/, 22];
                    case 20:
                        e_6_1 = _q.sent();
                        e_6 = { error: e_6_1 };
                        return [3 /*break*/, 22];
                    case 21:
                        try {
                            if (_h && !_h.done && (_m = _g.return)) _m.call(_g);
                        }
                        finally { if (e_6) throw e_6.error; }
                        return [7 /*endfinally*/];
                    case 22: return [4 /*yield*/, findUser(transaction, { discordUserId: caller.id })];
                    case 23:
                        if (!((_q.sent()).teamId != null)) return [3 /*break*/, 25];
                        return [4 /*yield*/, interaction.editReply("You are still in a team")];
                    case 24:
                        _q.sent();
                        return [2 /*return*/];
                    case 25:
                        _q.trys.push([25, 31, 32, 33]);
                        teamMates_1 = __values(teamMates), teamMates_1_1 = teamMates_1.next();
                        _q.label = 26;
                    case 26:
                        if (!!teamMates_1_1.done) return [3 /*break*/, 30];
                        teamMate = teamMates_1_1.value;
                        return [4 /*yield*/, findUser(transaction, { discordUserId: teamMate.id })];
                    case 27:
                        if (!((_q.sent()).teamId != null)) return [3 /*break*/, 29];
                        return [4 /*yield*/, interaction.editReply("A team mate is still in a team")];
                    case 28:
                        _q.sent();
                        return [2 /*return*/];
                    case 29:
                        teamMates_1_1 = teamMates_1.next();
                        return [3 /*break*/, 26];
                    case 30: return [3 /*break*/, 33];
                    case 31:
                        e_7_1 = _q.sent();
                        e_7 = { error: e_7_1 };
                        return [3 /*break*/, 33];
                    case 32:
                        try {
                            if (teamMates_1_1 && !teamMates_1_1.done && (_o = teamMates_1.return)) _o.call(teamMates_1);
                        }
                        finally { if (e_7) throw e_7.error; }
                        return [7 /*endfinally*/];
                    case 33: 
                    // create delayed interaction info
                    return [4 /*yield*/, interaction.editReply(".")];
                    case 34:
                        // create delayed interaction info
                        _q.sent();
                        return [4 /*yield*/, interaction.fetchReply()];
                    case 35:
                        previousMessage = _q.sent();
                        return [4 /*yield*/, interaction.channel.messages.fetch(previousMessage.id)];
                    case 36: return [4 /*yield*/, (_q.sent()).reply(".")];
                    case 37:
                        message = _q.sent();
                        return [4 /*yield*/, transaction.fetch("/interactions")];
                    case 38:
                        // const message = await interaction.fetchReply();
                        ((_a = (_b = (_q.sent())).interactionIds) !== null && _a !== void 0 ? _a : (_b.interactionIds = [])).push(message.id);
                        return [4 /*yield*/, transaction.fetch("/interaction/" + message.id)];
                    case 39:
                        info = _q.sent();
                        _k = (_j = Object).assign;
                        _l = [info];
                        _p = {
                            id: message.id,
                            type: "teamCreate",
                            futureTeamId: interaction.id,
                            futureTeamName: teamName
                        };
                        return [4 /*yield*/, (function () { return __awaiter(_this, void 0, void 0, function () {
                                var waiting, teamMates_2, teamMates_2_1, teamMate, _a, _b, e_8_1;
                                var e_8, _c;
                                return __generator(this, function (_d) {
                                    switch (_d.label) {
                                        case 0:
                                            waiting = [];
                                            _d.label = 1;
                                        case 1:
                                            _d.trys.push([1, 6, 7, 8]);
                                            teamMates_2 = __values(teamMates), teamMates_2_1 = teamMates_2.next();
                                            _d.label = 2;
                                        case 2:
                                            if (!!teamMates_2_1.done) return [3 /*break*/, 5];
                                            teamMate = teamMates_2_1.value;
                                            _b = (_a = waiting).push;
                                            return [4 /*yield*/, findUser(transaction, { discordUserId: teamMate.id })];
                                        case 3:
                                            _b.apply(_a, [(_d.sent()).id]);
                                            _d.label = 4;
                                        case 4:
                                            teamMates_2_1 = teamMates_2.next();
                                            return [3 /*break*/, 2];
                                        case 5: return [3 /*break*/, 8];
                                        case 6:
                                            e_8_1 = _d.sent();
                                            e_8 = { error: e_8_1 };
                                            return [3 /*break*/, 8];
                                        case 7:
                                            try {
                                                if (teamMates_2_1 && !teamMates_2_1.done && (_c = teamMates_2.return)) _c.call(teamMates_2);
                                            }
                                            finally { if (e_8) throw e_8.error; }
                                            return [7 /*endfinally*/];
                                        case 8: return [2 /*return*/, waiting];
                                    }
                                });
                            }); })()];
                    case 40:
                        _p.waiting = _q.sent(),
                            _p.accepted = [],
                            _p.declined = [];
                        return [4 /*yield*/, findUser(transaction, { discordUserId: caller.id })];
                    case 41:
                        _k.apply(_j, _l.concat([(_p.caller = (_q.sent()).id,
                                _p)]));
                        // complete command and commit transaction
                        return [4 /*yield*/, transaction.commit()];
                    case 42:
                        // complete command and commit transaction
                        _q.sent();
                        // create message that has buttons for confirming stuff
                        return [4 /*yield*/, message.edit({
                                content: "Awaiting confirmation from " + teamMates.map(function (teamMate) { return teamMate.toString(); }).join(", ") + " to create new team called " + teamName,
                                components: [
                                    new discord_js_1.MessageActionRow().addComponents(new discord_js_1.MessageButton()
                                        .setCustomId("accept")
                                        .setLabel("Accept")
                                        .setStyle("SUCCESS"), new discord_js_1.MessageButton()
                                        .setCustomId("decline")
                                        .setLabel("Decline")
                                        .setStyle("DANGER"), new discord_js_1.MessageButton()
                                        .setCustomId("cancel")
                                        .setLabel("Cancel")
                                        .setStyle("SECONDARY")),
                                ],
                            })];
                    case 43:
                        // create message that has buttons for confirming stuff
                        _q.sent();
                        return [2 /*return*/];
                }
            });
        });
    },
    join: function (interaction, metadata) {
        var _a;
        var _b;
        return __awaiter(this, void 0, void 0, function () {
            var teamName, transaction, caller, team, teamMates, _c, _d, memberId, _e, _f, _g, _h, e_9_1, nextInteraction, _j, _k, e_10, message, _l, _m, info, _o, _p, _q;
            var e_9, _r, _s;
            return __generator(this, function (_t) {
                switch (_t.label) {
                    case 0:
                        assert(interaction.guild);
                        assert(interaction.channel);
                        teamName = interaction.options.getString("team-name", true);
                        // log command and setup transaction
                        console.log(["team", "join", teamName, metadata]);
                        transaction = createTransaction(resources);
                        caller = interaction.user;
                        return [4 /*yield*/, findTeam(transaction, { name: teamName })];
                    case 1:
                        team = _t.sent();
                        if (!(team == null)) return [3 /*break*/, 3];
                        return [4 /*yield*/, interaction.editReply("Team called " + teamName + " doesn't exist")];
                    case 2:
                        _t.sent();
                        return [2 /*return*/];
                    case 3: return [4 /*yield*/, findUser(transaction, { discordUserId: caller.id })];
                    case 4:
                        if (!((_t.sent()) == null)) return [3 /*break*/, 6];
                        return [4 /*yield*/, createUser(interaction.guild, transaction, { id: "" + interaction.id + caller.id, discordUserId: caller.id })];
                    case 5:
                        _t.sent();
                        _t.label = 6;
                    case 6: return [4 /*yield*/, findUser(transaction, { discordUserId: caller.id })];
                    case 7:
                        if (!((_t.sent()).teamId != null)) return [3 /*break*/, 9];
                        return [4 /*yield*/, interaction.editReply("You are still in a team")];
                    case 8:
                        _t.sent();
                        return [2 /*return*/];
                    case 9:
                        teamMates = [];
                        _t.label = 10;
                    case 10:
                        _t.trys.push([10, 16, 17, 18]);
                        _c = __values(team.memberIds), _d = _c.next();
                        _t.label = 11;
                    case 11:
                        if (!!_d.done) return [3 /*break*/, 15];
                        memberId = _d.value;
                        _f = (_e = teamMates).push;
                        _h = (_g = interaction.guild.members).fetch;
                        return [4 /*yield*/, fetchUser(transaction, memberId)];
                    case 12: return [4 /*yield*/, _h.apply(_g, [(_t.sent()).discordUserId])];
                    case 13:
                        _f.apply(_e, [_t.sent()]);
                        _t.label = 14;
                    case 14:
                        _d = _c.next();
                        return [3 /*break*/, 11];
                    case 15: return [3 /*break*/, 18];
                    case 16:
                        e_9_1 = _t.sent();
                        e_9 = { error: e_9_1 };
                        return [3 /*break*/, 18];
                    case 17:
                        try {
                            if (_d && !_d.done && (_r = _c.return)) _r.call(_c);
                        }
                        finally { if (e_9) throw e_9.error; }
                        return [7 /*endfinally*/];
                    case 18:
                        ;
                        // confirm with caller
                        return [4 /*yield*/, interaction.editReply({
                                content: "Just to confirm, are you attempting to join team " + team.name + " with members " + teamMates.map(function (member) { return member.user.username; }).join(", ") + "?",
                                components: [
                                    new discord_js_1.MessageActionRow().addComponents(new discord_js_1.MessageButton()
                                        .setCustomId("yes")
                                        .setLabel("Confirm")
                                        .setStyle("SUCCESS"), new discord_js_1.MessageButton()
                                        .setCustomId("no")
                                        .setLabel("Cancel")
                                        .setStyle("DANGER")),
                                ],
                            })];
                    case 19:
                        // confirm with caller
                        _t.sent();
                        _t.label = 20;
                    case 20:
                        _t.trys.push([20, 24, , 25]);
                        _k = (_j = interaction.channel.messages).fetch;
                        return [4 /*yield*/, interaction.fetchReply()];
                    case 21: return [4 /*yield*/, _k.apply(_j, [(_t.sent()).id])];
                    case 22: return [4 /*yield*/, (_t.sent()).awaitMessageComponent({
                            filter: function (interaction) { return interaction.user.id === caller.id; },
                            time: 10000,
                        })];
                    case 23:
                        nextInteraction = _t.sent();
                        return [3 /*break*/, 25];
                    case 24:
                        e_10 = _t.sent();
                        nextInteraction = undefined;
                        return [3 /*break*/, 25];
                    case 25:
                        if (!(nextInteraction == null)) return [3 /*break*/, 27];
                        return [4 /*yield*/, interaction.followUp({ content: "Confirmation timed out", components: [] })];
                    case 26:
                        _t.sent();
                        return [2 /*return*/];
                    case 27:
                        if (!(nextInteraction.customId === "no")) return [3 /*break*/, 29];
                        return [4 /*yield*/, interaction.followUp({ content: "Cancelled join request", components: [] })];
                    case 28:
                        _t.sent();
                        return [2 /*return*/];
                    case 29:
                        if (!(team.memberIds.length >= 4)) return [3 /*break*/, 31];
                        return [4 /*yield*/, interaction.followUp("Requested team is full")];
                    case 30:
                        _t.sent();
                        return [2 /*return*/];
                    case 31:
                        _m = (_l = interaction.channel.messages).fetch;
                        return [4 /*yield*/, interaction.fetchReply()];
                    case 32: return [4 /*yield*/, _m.apply(_l, [(_t.sent()).id])];
                    case 33: return [4 /*yield*/, (_t.sent()).reply("...")];
                    case 34:
                        message = _t.sent();
                        return [4 /*yield*/, transaction.fetch("/interactions")];
                    case 35:
                        // const message = await interaction.followUp({ content: ".", fetchReply: true });
                        ((_a = (_b = (_t.sent())).interactionIds) !== null && _a !== void 0 ? _a : (_b.interactionIds = [])).push(message.id);
                        return [4 /*yield*/, transaction.fetch("/interaction/" + message.id)];
                    case 36:
                        info = _t.sent();
                        _p = (_o = Object).assign;
                        _q = [info];
                        _s = {
                            id: message.id,
                            type: "teamJoin",
                            teamId: team.id,
                            waiting: __spreadArray([], __read(team.memberIds), false),
                            approved: [],
                            rejected: []
                        };
                        return [4 /*yield*/, findUser(transaction, { discordUserId: caller.id })];
                    case 37:
                        _p.apply(_o, _q.concat([(_s.caller = (_t.sent()).id,
                                _s)]));
                        // complete command and commit transaction
                        return [4 /*yield*/, transaction.commit()];
                    case 38:
                        // complete command and commit transaction
                        _t.sent();
                        // create message that has buttons for confirming stuff
                        return [4 /*yield*/, message.edit({
                                content: "Awaiting approval from team " + teamName + " with members " + teamMates.map(function (member) { return member.toString(); }).join(", ") + " to approve " + caller + " joining",
                                components: [
                                    new discord_js_1.MessageActionRow().addComponents(new discord_js_1.MessageButton()
                                        .setCustomId("approve")
                                        .setLabel("Approve")
                                        .setStyle("SUCCESS"), new discord_js_1.MessageButton()
                                        .setCustomId("reject")
                                        .setLabel("Reject")
                                        .setStyle("DANGER"), new discord_js_1.MessageButton()
                                        .setCustomId("cancel")
                                        .setLabel("Cancel")
                                        .setStyle("SECONDARY")),
                                ],
                            })];
                    case 39:
                        // create message that has buttons for confirming stuff
                        _t.sent();
                        return [2 /*return*/];
                }
            });
        });
    },
    rename: function (interaction, metadata) {
        var _a;
        var _b;
        return __awaiter(this, void 0, void 0, function () {
            var newTeamName, transaction, caller, callerUser, team, teamMates, _c, _d, memberId, _e, _f, _g, _h, e_11_1, message, _j, _k, info;
            var e_11, _l;
            return __generator(this, function (_m) {
                switch (_m.label) {
                    case 0:
                        assert(interaction.guild);
                        assert(interaction.channel);
                        newTeamName = interaction.options.getString("new-team-name", true);
                        // log command and setup transaction
                        console.log(["team", "rename", newTeamName, metadata]);
                        transaction = createTransaction(resources);
                        caller = interaction.user;
                        return [4 /*yield*/, findUser(transaction, { discordUserId: caller.id })];
                    case 1:
                        callerUser = _m.sent();
                        if (!(callerUser == null)) return [3 /*break*/, 3];
                        return [4 /*yield*/, createUser(interaction.guild, transaction, { id: "" + interaction.id + caller.id, discordUserId: caller.id })];
                    case 2:
                        callerUser = _m.sent();
                        _m.label = 3;
                    case 3:
                        if (!(callerUser.teamId == null)) return [3 /*break*/, 5];
                        return [4 /*yield*/, interaction.editReply("You are not in a team")];
                    case 4:
                        _m.sent();
                        return [2 /*return*/];
                    case 5:
                        if (!!(newTeamName.length <= 32)) return [3 /*break*/, 7];
                        return [4 /*yield*/, interaction.editReply("Team name " + newTeamName + " too long")];
                    case 6:
                        _m.sent();
                        return [2 /*return*/];
                    case 7: return [4 /*yield*/, findTeam(transaction, { name: newTeamName })];
                    case 8:
                        if (!((_m.sent()) != null)) return [3 /*break*/, 10];
                        return [4 /*yield*/, interaction.editReply("Team called " + newTeamName + " already exists")];
                    case 9:
                        _m.sent();
                        return [2 /*return*/];
                    case 10: return [4 /*yield*/, fetchTeam(transaction, callerUser.teamId)];
                    case 11:
                        team = _m.sent();
                        teamMates = [];
                        _m.label = 12;
                    case 12:
                        _m.trys.push([12, 18, 19, 20]);
                        _c = __values(team.memberIds), _d = _c.next();
                        _m.label = 13;
                    case 13:
                        if (!!_d.done) return [3 /*break*/, 17];
                        memberId = _d.value;
                        _f = (_e = teamMates).push;
                        _h = (_g = interaction.guild.members).fetch;
                        return [4 /*yield*/, fetchUser(transaction, memberId)];
                    case 14: return [4 /*yield*/, _h.apply(_g, [(_m.sent()).discordUserId])];
                    case 15:
                        _f.apply(_e, [_m.sent()]);
                        _m.label = 16;
                    case 16:
                        _d = _c.next();
                        return [3 /*break*/, 13];
                    case 17: return [3 /*break*/, 20];
                    case 18:
                        e_11_1 = _m.sent();
                        e_11 = { error: e_11_1 };
                        return [3 /*break*/, 20];
                    case 19:
                        try {
                            if (_d && !_d.done && (_l = _c.return)) _l.call(_c);
                        }
                        finally { if (e_11) throw e_11.error; }
                        return [7 /*endfinally*/];
                    case 20:
                        ;
                        // create delayed interaction info
                        return [4 /*yield*/, interaction.editReply(".")];
                    case 21:
                        // create delayed interaction info
                        _m.sent();
                        _k = (_j = interaction.channel.messages).fetch;
                        return [4 /*yield*/, interaction.fetchReply()];
                    case 22: return [4 /*yield*/, _k.apply(_j, [(_m.sent()).id])];
                    case 23:
                        message = _m.sent();
                        return [4 /*yield*/, transaction.fetch("/interactions")];
                    case 24:
                        // const message = await interaction.fetchReply();
                        ((_a = (_b = (_m.sent())).interactionIds) !== null && _a !== void 0 ? _a : (_b.interactionIds = [])).push(message.id);
                        return [4 /*yield*/, transaction.fetch("/interaction/" + message.id)];
                    case 25:
                        info = _m.sent();
                        Object.assign(info, {
                            id: message.id,
                            type: "teamRename",
                            teamId: team.id,
                            waiting: removeFromArray(__spreadArray([], __read(team.memberIds), false), callerUser.id),
                            approved: [callerUser.id],
                            rejected: [],
                            caller: callerUser.id,
                            newTeamName: newTeamName,
                        });
                        // complete command and commit transaction
                        return [4 /*yield*/, transaction.commit()];
                    case 26:
                        // complete command and commit transaction
                        _m.sent();
                        // create message that has buttons for confirming stuff
                        return [4 /*yield*/, message.edit({
                                content: "Awaiting approval from team members " + teamMates.filter(function (member) { return member.id !== caller.id; }).map(function (member) { return member.toString(); }).join(", ") + " to approve renaming team to " + newTeamName,
                                components: [
                                    new discord_js_1.MessageActionRow().addComponents(new discord_js_1.MessageButton()
                                        .setCustomId("approve")
                                        .setLabel("Approve")
                                        .setStyle("SUCCESS"), new discord_js_1.MessageButton()
                                        .setCustomId("reject")
                                        .setLabel("Reject")
                                        .setStyle("DANGER"), new discord_js_1.MessageButton()
                                        .setCustomId("cancel")
                                        .setLabel("Cancel")
                                        .setStyle("SECONDARY")),
                                ],
                            })];
                    case 27:
                        // create message that has buttons for confirming stuff
                        _m.sent();
                        return [2 /*return*/];
                }
            });
        });
    },
    leave: function (interaction, metadata) {
        return __awaiter(this, void 0, void 0, function () {
            var transaction, caller, callerUser;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        // log command and setup transaction
                        console.log(["team", "leave", metadata]);
                        transaction = createTransaction(resources);
                        caller = interaction.user;
                        return [4 /*yield*/, findUser(transaction, { discordUserId: caller.id })];
                    case 1:
                        callerUser = _a.sent();
                        if (!(callerUser == null)) return [3 /*break*/, 3];
                        return [4 /*yield*/, createUser(interaction.guild, transaction, { id: "" + interaction.id + caller.id, discordUserId: caller.id })];
                    case 2:
                        callerUser = _a.sent();
                        _a.label = 3;
                    case 3:
                        if (!(callerUser.teamId == null)) return [3 /*break*/, 5];
                        return [4 /*yield*/, interaction.editReply("You are not in a team")];
                    case 4:
                        _a.sent();
                        return [2 /*return*/];
                    case 5: 
                    // complete command and commit transaction
                    return [4 /*yield*/, transaction.commit()];
                    case 6:
                        // complete command and commit transaction
                        _a.sent();
                        // create message with further instructions for leaving a team
                        return [4 /*yield*/, interaction.editReply([
                                "Hello! It seems you want to leave your team. ",
                                "There are many consequences with leaving a team, such as",
                                "not being able to join back, no points being awarded to you after this month, and more.",
                                "If you understand these consequences and still wish to continue,",
                                "please DM a leader for further action. Thanks :D",
                            ].join(" "))];
                    case 7:
                        // create message with further instructions for leaving a team
                        _a.sent();
                        return [2 /*return*/];
                }
            });
        });
    },
    "join-random": function (interaction, metadata) { return __awaiter(void 0, void 0, void 0, function () {
        var transaction, caller, callerUser, joinRandomInfo, teamName, otherUser, team, _a, _b, _c, _d, _e, _f, message, _g, _h, info;
        var _j, _k;
        var _l;
        return __generator(this, function (_m) {
            switch (_m.label) {
                case 0:
                    assert(interaction.guild);
                    assert(interaction.channel);
                    // log command and setup transaction
                    console.log(["team", "join-random", metadata]);
                    transaction = createTransaction(resources);
                    caller = interaction.user;
                    return [4 /*yield*/, findUser(transaction, { discordUserId: caller.id })];
                case 1:
                    callerUser = _m.sent();
                    if (!(callerUser == null)) return [3 /*break*/, 3];
                    return [4 /*yield*/, createUser(interaction.guild, transaction, { id: "" + interaction.id + caller.id, discordUserId: caller.id })];
                case 2:
                    callerUser = _m.sent();
                    _m.label = 3;
                case 3:
                    if (!(callerUser.teamId != null)) return [3 /*break*/, 5];
                    return [4 /*yield*/, interaction.editReply("You are already in a team")];
                case 4:
                    _m.sent();
                    return [2 /*return*/];
                case 5: return [4 /*yield*/, transaction.fetch("/joinRandom")];
                case 6:
                    joinRandomInfo = _m.sent();
                    if (!("start" in joinRandomInfo)) return [3 /*break*/, 22];
                    if (!(joinRandomInfo.caller === callerUser.id)) return [3 /*break*/, 8];
                    return [4 /*yield*/, interaction.editReply("You are already waiting to join a random team")];
                case 7:
                    _m.sent();
                    return [2 /*return*/];
                case 8:
                    teamName = "" + Math.floor(Math.random() * 2000);
                    return [4 /*yield*/, findTeam(transaction, { name: teamName })];
                case 9:
                    if ((_m.sent()) != null)
                        throw Error("lol just try again pls: team name collided");
                    return [4 /*yield*/, fetchUser(transaction, joinRandomInfo.caller)];
                case 10:
                    otherUser = _m.sent();
                    if (!(otherUser.teamId == null)) return [3 /*break*/, 22];
                    return [4 /*yield*/, createTeam(interaction.guild, transaction, { id: interaction.id, name: teamName, freeToJoin: true })];
                case 11:
                    team = _m.sent();
                    return [4 /*yield*/, joinTeam(interaction.guild, transaction, team, otherUser)];
                case 12:
                    _m.sent();
                    return [4 /*yield*/, joinTeam(interaction.guild, transaction, team, callerUser)];
                case 13:
                    _m.sent();
                    return [4 /*yield*/, interaction.guild.channels.fetch(joinRandomInfo.discordChannelId)];
                case 14: return [4 /*yield*/, (_m.sent()).messages.fetch(joinRandomInfo.discordMessageId)];
                case 15:
                    // remove previous message and clear info
                    (_m.sent()).delete();
                    _a = removeFromArray;
                    return [4 /*yield*/, transaction.fetch("/interactions")];
                case 16:
                    _a.apply(void 0, [(_j = (_m.sent()).interactionIds) !== null && _j !== void 0 ? _j : [], joinRandomInfo.interactionId]);
                    _b = clearObject;
                    return [4 /*yield*/, transaction.fetch("/interaction/" + joinRandomInfo.interactionId)];
                case 17:
                    _b.apply(void 0, [_m.sent()]);
                    clearObject(joinRandomInfo);
                    // complete command
                    return [4 /*yield*/, transaction.commit()];
                case 18:
                    // complete command
                    _m.sent();
                    _d = (_c = interaction).editReply;
                    _e = "Team " + team.name + " with members ";
                    return [4 /*yield*/, interaction.guild.members.fetch(callerUser.discordUserId)];
                case 19:
                    _f = _e + (_m.sent()) + " and ";
                    return [4 /*yield*/, interaction.guild.members.fetch(otherUser.discordUserId)];
                case 20: return [4 /*yield*/, _d.apply(_c, [_f + (_m.sent()) + " is created"])];
                case 21:
                    _m.sent();
                    return [2 /*return*/];
                case 22:
                    _h = (_g = interaction.channel.messages).fetch;
                    return [4 /*yield*/, interaction.fetchReply()];
                case 23: return [4 /*yield*/, _h.apply(_g, [(_m.sent()).id])];
                case 24:
                    message = _m.sent();
                    return [4 /*yield*/, transaction.fetch("/interactions")];
                case 25:
                    ((_k = (_l = (_m.sent())).interactionIds) !== null && _k !== void 0 ? _k : (_l.interactionIds = [])).push(message.id);
                    return [4 /*yield*/, transaction.fetch("/interaction/" + message.id)];
                case 26:
                    info = _m.sent();
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
                    return [4 /*yield*/, transaction.commit()];
                case 27:
                    // complete command and commit transaction
                    _m.sent();
                    return [4 /*yield*/, interaction.editReply({
                            content: caller + " is looking for a team! DM them if you want to team up!",
                            components: [
                                new discord_js_1.MessageActionRow().addComponents(new discord_js_1.MessageButton()
                                    .setCustomId("cancel")
                                    .setLabel("Cancel")
                                    .setStyle("SECONDARY")),
                            ],
                        })];
                case 28:
                    _m.sent();
                    return [4 /*yield*/, caller.fetch()];
                case 29: return [4 /*yield*/, (_m.sent()).createDM()];
                case 30: return [4 /*yield*/, (_m.sent()).send("If you aren't in a team after 30 minutes and haven't cancelled, I'll automatically place you in a team :D")];
                case 31:
                    _m.sent();
                    return [2 /*return*/];
            }
        });
    }); },
};
// accept: ✅
// deny: ❌
// cancel: 🗑️
/*
const filter = (reaction, user) => reaction.emoji.name === '👍' && user.id === message.author.id;
const reactions = await message.awaitReactions({ filter, max: 1, time: 60_000 });
*/
// Process button interactions
client.on("interactionCreate", function (interaction) { return __awaiter(void 0, void 0, void 0, function () {
    var message, _a, _b, caller, transaction, info, callerUser, _c, team, _d, _e, userId, _f, _g, e_12_1, teamMates, _h, _j, memberId, _k, _l, _m, _o, e_13_1, _p, team, _q, teamName, _r, teamName, _s, team, numMembers, callerUser, callerDiscordUser, _t, _u, _v, _w, _x, callerDiscordUser, _y, _z, _0, _1, team, numMembers, callerUser, oldTeamName, _2, _3, teamName, _4, teamName, _5, callerUser, _6, joinRandomInfo, workshop, e_14, e_15;
    var e_12, _7, e_13, _8;
    var _9;
    return __generator(this, function (_10) {
        switch (_10.label) {
            case 0:
                if (!interaction.isButton())
                    return [2 /*return*/];
                return [4 /*yield*/, interaction.deferUpdate()];
            case 1:
                _10.sent();
                console.log({
                    timestamp: Date.now(),
                    userDisplayName: interaction.user.username + "#" + interaction.user.discriminator,
                    userId: interaction.user.id,
                    messageId: interaction.message.id,
                    customId: interaction.customId,
                });
                _10.label = 2;
            case 2:
                _10.trys.push([2, 196, 201, 202]);
                if (running)
                    return [2 /*return*/];
                running = true;
                assert(interaction.guild);
                assert(interaction.channel);
                _b = (_a = interaction.channel.messages).fetch;
                return [4 /*yield*/, interaction.fetchReply()];
            case 3: return [4 /*yield*/, _b.apply(_a, [(_10.sent()).id])];
            case 4:
                message = _10.sent();
                return [4 /*yield*/, interaction.guild.members.fetch(interaction.user.id)];
            case 5:
                caller = _10.sent();
                transaction = createTransaction(resources);
                return [4 /*yield*/, transaction.fetch("/interactions")];
            case 6:
                if (!((_9 = (_10.sent()).interactionIds) !== null && _9 !== void 0 ? _9 : []).includes(interaction.message.id)) {
                    // await interaction.editReply(`Could not find interaction to continue`);
                    console.log("unknown interaction");
                    return [2 /*return*/];
                }
                return [4 /*yield*/, transaction.fetch("/interaction/" + interaction.message.id)];
            case 7:
                info = _10.sent();
                if (!(info.type === "teamCreate")) return [3 /*break*/, 81];
                return [4 /*yield*/, findUser(transaction, { discordUserId: caller.id })];
            case 8:
                callerUser = _10.sent();
                if (!(callerUser == null)) return [3 /*break*/, 10];
                return [4 /*yield*/, createUser(interaction.guild, transaction, { id: "" + interaction.id + caller.id, discordUserId: caller.id })];
            case 9:
                callerUser = _10.sent();
                _10.label = 10;
            case 10:
                if (!(interaction.customId === "accept")) return [3 /*break*/, 60];
                if (!(info.caller === callerUser.id)) return [3 /*break*/, 12];
                return [4 /*yield*/, message.reply("Caller cannot accept own invitation")];
            case 11:
                _10.sent();
                return [2 /*return*/];
            case 12:
                if (!info.accepted.includes(callerUser.id)) return [3 /*break*/, 14];
                return [4 /*yield*/, message.reply("Caller cannot accept invitation again")];
            case 13:
                _10.sent();
                return [2 /*return*/];
            case 14:
                if (!info.declined.includes(callerUser.id)) return [3 /*break*/, 16];
                return [4 /*yield*/, message.reply("Caller cannot accept invitation after declining")];
            case 15:
                _10.sent();
                return [2 /*return*/];
            case 16:
                if (!!info.waiting.includes(callerUser.id)) return [3 /*break*/, 18];
                return [4 /*yield*/, message.reply("Caller wasn't invited")];
            case 17:
                _10.sent();
                return [2 /*return*/];
            case 18:
                if (!(callerUser.teamId != null)) return [3 /*break*/, 21];
                return [4 /*yield*/, transaction.commit()];
            case 19:
                _10.sent();
                return [4 /*yield*/, message.reply("Caller is on a team")];
            case 20:
                _10.sent();
                return [2 /*return*/];
            case 21:
                if (!(info.accepted.length === 1)) return [3 /*break*/, 50];
                return [4 /*yield*/, findTeam(transaction, { name: info.futureTeamName })];
            case 22:
                if (!((_10.sent()) != null)) return [3 /*break*/, 26];
                _c = removeFromArray;
                return [4 /*yield*/, transaction.fetch("/interactions")];
            case 23:
                _c.apply(void 0, [(_10.sent()).interactionIds, interaction.message.id]);
                clearObject(info);
                return [4 /*yield*/, transaction.commit()];
            case 24:
                _10.sent();
                return [4 /*yield*/, message.reply("Team called " + info.futureTeamName + " now exists")];
            case 25:
                _10.sent();
                return [2 /*return*/];
            case 26:
                removeFromArray(info.waiting, callerUser.id);
                info.accepted.push(callerUser.id);
                return [4 /*yield*/, createTeam(interaction.guild, transaction, {
                        id: info.futureTeamId,
                        name: info.futureTeamName,
                    })];
            case 27:
                team = _10.sent();
                _10.label = 28;
            case 28:
                _10.trys.push([28, 34, 35, 36]);
                _d = __values(__spreadArray([info.caller], __read(info.accepted), false)), _e = _d.next();
                _10.label = 29;
            case 29:
                if (!!_e.done) return [3 /*break*/, 33];
                userId = _e.value;
                _f = joinTeam;
                _g = [interaction.guild, transaction, team];
                return [4 /*yield*/, fetchUser(transaction, userId)];
            case 30: return [4 /*yield*/, _f.apply(void 0, _g.concat([_10.sent()]))];
            case 31:
                _10.sent();
                _10.label = 32;
            case 32:
                _e = _d.next();
                return [3 /*break*/, 29];
            case 33: return [3 /*break*/, 36];
            case 34:
                e_12_1 = _10.sent();
                e_12 = { error: e_12_1 };
                return [3 /*break*/, 36];
            case 35:
                try {
                    if (_e && !_e.done && (_7 = _d.return)) _7.call(_d);
                }
                finally { if (e_12) throw e_12.error; }
                return [7 /*endfinally*/];
            case 36:
                teamMates = [];
                _10.label = 37;
            case 37:
                _10.trys.push([37, 43, 44, 45]);
                _h = __values(team.memberIds), _j = _h.next();
                _10.label = 38;
            case 38:
                if (!!_j.done) return [3 /*break*/, 42];
                memberId = _j.value;
                _l = (_k = teamMates).push;
                _o = (_m = interaction.guild.members).fetch;
                return [4 /*yield*/, fetchUser(transaction, memberId)];
            case 39: return [4 /*yield*/, _o.apply(_m, [(_10.sent()).discordUserId])];
            case 40:
                _l.apply(_k, [_10.sent()]);
                _10.label = 41;
            case 41:
                _j = _h.next();
                return [3 /*break*/, 38];
            case 42: return [3 /*break*/, 45];
            case 43:
                e_13_1 = _10.sent();
                e_13 = { error: e_13_1 };
                return [3 /*break*/, 45];
            case 44:
                try {
                    if (_j && !_j.done && (_8 = _h.return)) _8.call(_h);
                }
                finally { if (e_13) throw e_13.error; }
                return [7 /*endfinally*/];
            case 45:
                ;
                if (!(info.waiting.length === 0)) return [3 /*break*/, 47];
                _p = removeFromArray;
                return [4 /*yield*/, transaction.fetch("/interactions")];
            case 46:
                _p.apply(void 0, [(_10.sent()).interactionIds, interaction.message.id]);
                clearObject(info);
                _10.label = 47;
            case 47: return [4 /*yield*/, transaction.commit()];
            case 48:
                _10.sent();
                return [4 /*yield*/, message.reply("Team " + team.name + " with members " + teamMates.map(function (member) { return member.toString(); }).join(", ") + " is created")];
            case 49:
                _10.sent();
                return [2 /*return*/];
            case 50: return [4 /*yield*/, fetchTeam(transaction, info.futureTeamId)];
            case 51:
                team = _10.sent();
                if (!(team.memberIds.length >= 4)) return [3 /*break*/, 54];
                return [4 /*yield*/, transaction.commit()];
            case 52:
                _10.sent();
                return [4 /*yield*/, message.reply("Team " + info.futureTeamName + " is now full")];
            case 53:
                _10.sent();
                return [2 /*return*/];
            case 54:
                removeFromArray(info.waiting, callerUser.id);
                info.accepted.push(callerUser.id);
                return [4 /*yield*/, joinTeam(interaction.guild, transaction, team, callerUser)];
            case 55:
                _10.sent();
                if (!(info.waiting.length === 0)) return [3 /*break*/, 57];
                _q = removeFromArray;
                return [4 /*yield*/, transaction.fetch("/interactions")];
            case 56:
                _q.apply(void 0, [(_10.sent()).interactionIds, interaction.message.id]);
                clearObject(info);
                _10.label = 57;
            case 57: return [4 /*yield*/, transaction.commit()];
            case 58:
                _10.sent();
                return [4 /*yield*/, message.reply("Accepted invitation to " + team.name)];
            case 59:
                _10.sent();
                return [2 /*return*/];
            case 60:
                if (!(interaction.customId === "decline")) return [3 /*break*/, 75];
                if (!(info.caller === callerUser.id)) return [3 /*break*/, 62];
                return [4 /*yield*/, message.reply("Caller cannot decline own invitation")];
            case 61:
                _10.sent();
                return [2 /*return*/];
            case 62:
                if (!info.declined.includes(callerUser.id)) return [3 /*break*/, 64];
                return [4 /*yield*/, message.reply("Caller cannot decline invitation again")];
            case 63:
                _10.sent();
                return [2 /*return*/];
            case 64:
                if (!info.accepted.includes(callerUser.id)) return [3 /*break*/, 66];
                return [4 /*yield*/, message.reply("Caller cannot decline invitation after accepting")];
            case 65:
                _10.sent();
                return [2 /*return*/];
            case 66:
                if (!!info.waiting.includes(callerUser.id)) return [3 /*break*/, 68];
                return [4 /*yield*/, message.reply("Caller wasn't invited")];
            case 67:
                _10.sent();
                return [2 /*return*/];
            case 68:
                removeFromArray(info.waiting, callerUser.id);
                info.declined.push(callerUser.id);
                if (!(info.waiting.length == 0)) return [3 /*break*/, 72];
                teamName = info.futureTeamName;
                _r = removeFromArray;
                return [4 /*yield*/, transaction.fetch("/interactions")];
            case 69:
                _r.apply(void 0, [(_10.sent()).interactionIds, interaction.message.id]);
                clearObject(info);
                return [4 /*yield*/, transaction.commit()];
            case 70:
                _10.sent();
                return [4 /*yield*/, message.reply("Team " + teamName + " will not be created")];
            case 71:
                _10.sent();
                return [2 /*return*/];
            case 72: return [4 /*yield*/, transaction.commit()];
            case 73:
                _10.sent();
                return [4 /*yield*/, message.reply("Declined invitation to " + info.futureTeamName)];
            case 74:
                _10.sent();
                return [2 /*return*/];
            case 75:
                if (!(interaction.customId === "cancel")) return [3 /*break*/, 81];
                if (!(info.caller !== callerUser.id)) return [3 /*break*/, 77];
                return [4 /*yield*/, message.reply("Caller isn't inviter")];
            case 76:
                _10.sent();
                return [2 /*return*/];
            case 77:
                teamName = info.futureTeamName;
                _s = removeFromArray;
                return [4 /*yield*/, transaction.fetch("/interactions")];
            case 78:
                _s.apply(void 0, [(_10.sent()).interactionIds, interaction.message.id]);
                clearObject(info);
                return [4 /*yield*/, transaction.commit()];
            case 79:
                _10.sent();
                return [4 /*yield*/, message.reply("Invitations to team " + teamName + " cancelled")];
            case 80:
                _10.sent();
                return [2 /*return*/];
            case 81:
                if (!(info.type === "teamJoin")) return [3 /*break*/, 130];
                return [4 /*yield*/, fetchTeam(transaction, info.teamId)];
            case 82:
                team = _10.sent();
                numMembers = info.waiting.length + info.approved.length + info.declined.length;
                return [4 /*yield*/, findUser(transaction, { discordUserId: caller.id })];
            case 83:
                callerUser = _10.sent();
                if (!(callerUser == null)) return [3 /*break*/, 85];
                return [4 /*yield*/, createUser(interaction.guild, transaction, { id: "" + interaction.id + caller.id, discordUserId: caller.id })];
            case 84:
                callerUser = _10.sent();
                _10.label = 85;
            case 85:
                if (!(interaction.customId === "approve")) return [3 /*break*/, 109];
                if (!info.approved.includes(callerUser.id)) return [3 /*break*/, 87];
                return [4 /*yield*/, message.reply("Caller cannot approve join request again")];
            case 86:
                _10.sent();
                return [2 /*return*/];
            case 87:
                if (!info.rejected.includes(callerUser.id)) return [3 /*break*/, 89];
                return [4 /*yield*/, message.reply("Caller cannot approve join request after rejecting")];
            case 88:
                _10.sent();
                return [2 /*return*/];
            case 89:
                if (!!info.waiting.includes(callerUser.id)) return [3 /*break*/, 91];
                return [4 /*yield*/, message.reply("Caller not in team")];
            case 90:
                _10.sent();
                return [2 /*return*/];
            case 91:
                removeFromArray(info.waiting, callerUser.id);
                info.approved.push(callerUser.id);
                _u = (_t = interaction.guild.members).fetch;
                return [4 /*yield*/, fetchUser(transaction, info.caller)];
            case 92: return [4 /*yield*/, _u.apply(_t, [(_10.sent()).discordUserId])];
            case 93:
                callerDiscordUser = _10.sent();
                if (!(info.approved.length > numMembers / 2)) return [3 /*break*/, 106];
                if (!(team.memberIds.length >= 4)) return [3 /*break*/, 97];
                _v = removeFromArray;
                return [4 /*yield*/, transaction.fetch("/interactions")];
            case 94:
                _v.apply(void 0, [(_10.sent()).interactionIds, interaction.message.id]);
                clearObject(info);
                return [4 /*yield*/, transaction.commit()];
            case 95:
                _10.sent();
                return [4 /*yield*/, message.reply(callerDiscordUser + "'s requested team is now full")];
            case 96:
                _10.sent();
                return [2 /*return*/];
            case 97:
                if (!(callerUser.teamId != null)) return [3 /*break*/, 101];
                _w = removeFromArray;
                return [4 /*yield*/, transaction.fetch("/interactions")];
            case 98:
                _w.apply(void 0, [(_10.sent()).interactionIds, interaction.message.id]);
                clearObject(info);
                return [4 /*yield*/, transaction.commit()];
            case 99:
                _10.sent();
                return [4 /*yield*/, message.reply(callerDiscordUser + " now has a team")];
            case 100:
                _10.sent();
                return [2 /*return*/];
            case 101: return [4 /*yield*/, joinTeam(interaction.guild, transaction, team, callerUser)];
            case 102:
                _10.sent();
                _x = removeFromArray;
                return [4 /*yield*/, transaction.fetch("/interactions")];
            case 103:
                _x.apply(void 0, [(_10.sent()).interactionIds, interaction.message.id]);
                clearObject(info);
                return [4 /*yield*/, transaction.commit()];
            case 104:
                _10.sent();
                return [4 /*yield*/, message.reply(callerDiscordUser + " joined team " + team.name)];
            case 105:
                _10.sent();
                return [2 /*return*/];
            case 106: return [4 /*yield*/, transaction.commit()];
            case 107:
                _10.sent();
                return [4 /*yield*/, message.reply("Approved request from " + callerDiscordUser.user.username + " to " + team.name)];
            case 108:
                _10.sent();
                return [2 /*return*/];
            case 109:
                if (!(interaction.customId === "reject")) return [3 /*break*/, 124];
                if (!info.rejected.includes(callerUser.id)) return [3 /*break*/, 111];
                return [4 /*yield*/, message.reply("Caller cannot reject join request again")];
            case 110:
                _10.sent();
                return [2 /*return*/];
            case 111:
                if (!info.approved.includes(callerUser.id)) return [3 /*break*/, 113];
                return [4 /*yield*/, message.reply("Caller cannot reject join request after approving")];
            case 112:
                _10.sent();
                return [2 /*return*/];
            case 113:
                if (!!info.waiting.includes(callerUser.id)) return [3 /*break*/, 115];
                return [4 /*yield*/, message.reply("Caller not in team")];
            case 114:
                _10.sent();
                return [2 /*return*/];
            case 115:
                removeFromArray(info.waiting, callerUser.id);
                info.rejected.push(callerUser.id);
                _z = (_y = interaction.guild.members).fetch;
                return [4 /*yield*/, fetchUser(transaction, info.caller)];
            case 116: return [4 /*yield*/, _z.apply(_y, [(_10.sent()).discordUserId])];
            case 117:
                callerDiscordUser = _10.sent();
                if (!(info.rejected.length >= numMembers / 2)) return [3 /*break*/, 121];
                _0 = removeFromArray;
                return [4 /*yield*/, transaction.fetch("/interactions")];
            case 118:
                _0.apply(void 0, [(_10.sent()).interactionIds, interaction.message.id]);
                clearObject(info);
                return [4 /*yield*/, transaction.commit()];
            case 119:
                _10.sent();
                return [4 /*yield*/, message.reply("Rejected " + callerDiscordUser + "'s request to join team " + team.name)];
            case 120:
                _10.sent();
                return [2 /*return*/];
            case 121: return [4 /*yield*/, transaction.commit()];
            case 122:
                _10.sent();
                return [4 /*yield*/, message.reply("Rejected request from " + callerDiscordUser.user.username + " to " + team.name)];
            case 123:
                _10.sent();
                return [2 /*return*/];
            case 124:
                if (!(interaction.customId === "cancel")) return [3 /*break*/, 130];
                if (!(info.caller !== callerUser.id)) return [3 /*break*/, 126];
                return [4 /*yield*/, message.reply("Caller isn't join requester")];
            case 125:
                _10.sent();
                return [2 /*return*/];
            case 126:
                _1 = removeFromArray;
                return [4 /*yield*/, transaction.fetch("/interactions")];
            case 127:
                _1.apply(void 0, [(_10.sent()).interactionIds, interaction.message.id]);
                clearObject(info);
                return [4 /*yield*/, transaction.commit()];
            case 128:
                _10.sent();
                return [4 /*yield*/, message.reply("Request to join " + team.name + " was cancelled")];
            case 129:
                _10.sent();
                return [2 /*return*/];
            case 130:
                if (!(info.type === "teamRename")) return [3 /*break*/, 176];
                return [4 /*yield*/, fetchTeam(transaction, info.teamId)];
            case 131:
                team = _10.sent();
                numMembers = info.waiting.length + info.approved.length + info.rejected.length;
                return [4 /*yield*/, findUser(transaction, { discordUserId: caller.id })];
            case 132:
                callerUser = _10.sent();
                if (!(callerUser == null)) return [3 /*break*/, 134];
                return [4 /*yield*/, createUser(interaction.guild, transaction, { id: "" + interaction.id + caller.id, discordUserId: caller.id })];
            case 133:
                callerUser = _10.sent();
                _10.label = 134;
            case 134:
                if (!(interaction.customId === "approve")) return [3 /*break*/, 155];
                if (!(info.caller === callerUser.id)) return [3 /*break*/, 136];
                return [4 /*yield*/, message.reply("Caller cannot approve own rename request")];
            case 135:
                _10.sent();
                return [2 /*return*/];
            case 136:
                if (!info.approved.includes(callerUser.id)) return [3 /*break*/, 138];
                return [4 /*yield*/, message.reply("Caller cannot approve rename request again")];
            case 137:
                _10.sent();
                return [2 /*return*/];
            case 138:
                if (!info.rejected.includes(callerUser.id)) return [3 /*break*/, 140];
                return [4 /*yield*/, message.reply("Caller cannot approve rename request after rejecting")];
            case 139:
                _10.sent();
                return [2 /*return*/];
            case 140:
                if (!!info.waiting.includes(callerUser.id)) return [3 /*break*/, 142];
                return [4 /*yield*/, message.reply("Caller not in team")];
            case 141:
                _10.sent();
                return [2 /*return*/];
            case 142:
                removeFromArray(info.waiting, callerUser.id);
                info.approved.push(callerUser.id);
                if (!(info.approved.length > numMembers / 2)) return [3 /*break*/, 152];
                oldTeamName = team.name;
                return [4 /*yield*/, findTeam(transaction, { name: info.newTeamName })];
            case 143:
                if (!((_10.sent()) != null)) return [3 /*break*/, 147];
                _2 = removeFromArray;
                return [4 /*yield*/, transaction.fetch("/interactions")];
            case 144:
                _2.apply(void 0, [(_10.sent()).interactionIds, interaction.message.id]);
                clearObject(info);
                return [4 /*yield*/, transaction.commit()];
            case 145:
                _10.sent();
                return [4 /*yield*/, message.reply("Team called " + info.newTeamName + " now exists")];
            case 146:
                _10.sent();
                return [2 /*return*/];
            case 147: return [4 /*yield*/, renameTeam(interaction.guild, transaction, team, info.newTeamName)];
            case 148:
                _10.sent();
                _3 = removeFromArray;
                return [4 /*yield*/, transaction.fetch("/interactions")];
            case 149:
                _3.apply(void 0, [(_10.sent()).interactionIds, interaction.message.id]);
                clearObject(info);
                return [4 /*yield*/, transaction.commit()];
            case 150:
                _10.sent();
                return [4 /*yield*/, message.reply("Renamed team " + oldTeamName + " to " + team.name)];
            case 151:
                _10.sent();
                return [2 /*return*/];
            case 152: return [4 /*yield*/, transaction.commit()];
            case 153:
                _10.sent();
                return [4 /*yield*/, message.reply("Approved rename request from " + team.name + " to " + info.newTeamName)];
            case 154:
                _10.sent();
                return [2 /*return*/];
            case 155:
                if (!(interaction.customId === "reject")) return [3 /*break*/, 170];
                if (!(info.caller === callerUser.id)) return [3 /*break*/, 157];
                return [4 /*yield*/, message.reply("Caller cannot reject own rename request")];
            case 156:
                _10.sent();
                return [2 /*return*/];
            case 157:
                if (!info.rejected.includes(callerUser.id)) return [3 /*break*/, 159];
                return [4 /*yield*/, message.reply("Caller cannot reject rename request again")];
            case 158:
                _10.sent();
                return [2 /*return*/];
            case 159:
                if (!info.approved.includes(callerUser.id)) return [3 /*break*/, 161];
                return [4 /*yield*/, message.reply("Caller cannot reject rename request after approving")];
            case 160:
                _10.sent();
                return [2 /*return*/];
            case 161:
                if (!!info.waiting.includes(callerUser.id)) return [3 /*break*/, 163];
                return [4 /*yield*/, message.reply("Caller not in team")];
            case 162:
                _10.sent();
                return [2 /*return*/];
            case 163:
                removeFromArray(info.waiting, callerUser.id);
                info.rejected.push(callerUser.id);
                if (!(info.rejected.length >= numMembers / 2)) return [3 /*break*/, 167];
                teamName = info.newTeamName;
                _4 = removeFromArray;
                return [4 /*yield*/, transaction.fetch("/interactions")];
            case 164:
                _4.apply(void 0, [(_10.sent()).interactionIds, interaction.message.id]);
                clearObject(info);
                return [4 /*yield*/, transaction.commit()];
            case 165:
                _10.sent();
                return [4 /*yield*/, message.reply("Request to rename team " + team.name + " to " + teamName + " is rejected")];
            case 166:
                _10.sent();
                return [2 /*return*/];
            case 167: return [4 /*yield*/, transaction.commit()];
            case 168:
                _10.sent();
                return [4 /*yield*/, message.reply("Rejected rename request from " + team.name + " to " + info.newTeamName)];
            case 169:
                _10.sent();
                return [2 /*return*/];
            case 170:
                if (!(interaction.customId === "cancel")) return [3 /*break*/, 176];
                if (!(info.caller !== callerUser.id)) return [3 /*break*/, 172];
                return [4 /*yield*/, message.reply("Caller isn't rename requester")];
            case 171:
                _10.sent();
                return [2 /*return*/];
            case 172:
                teamName = info.newTeamName;
                _5 = removeFromArray;
                return [4 /*yield*/, transaction.fetch("/interactions")];
            case 173:
                _5.apply(void 0, [(_10.sent()).interactionIds, interaction.message.id]);
                clearObject(info);
                return [4 /*yield*/, transaction.commit()];
            case 174:
                _10.sent();
                return [4 /*yield*/, message.reply("Request to rename team " + team.name + " to " + teamName + " is cancelled")];
            case 175:
                _10.sent();
                return [2 /*return*/];
            case 176:
                if (!(info.type === "teamJoinRandom")) return [3 /*break*/, 188];
                return [4 /*yield*/, findUser(transaction, { discordUserId: caller.id })];
            case 177:
                callerUser = _10.sent();
                if (!(callerUser == null)) return [3 /*break*/, 179];
                return [4 /*yield*/, createUser(interaction.guild, transaction, { id: "" + interaction.id + caller.id, discordUserId: caller.id })];
            case 178:
                callerUser = _10.sent();
                _10.label = 179;
            case 179:
                if (!(interaction.customId === "cancel")) return [3 /*break*/, 188];
                if (!(info.caller !== callerUser.id)) return [3 /*break*/, 181];
                return [4 /*yield*/, message.reply("Caller isn't join random requester")];
            case 180:
                _10.sent();
                return [2 /*return*/];
            case 181:
                // remove interaction info and joinRandom info
                _6 = removeFromArray;
                return [4 /*yield*/, transaction.fetch("/interactions")];
            case 182:
                // remove interaction info and joinRandom info
                _6.apply(void 0, [(_10.sent()).interactionIds, interaction.message.id]);
                clearObject(info);
                return [4 /*yield*/, transaction.fetch("/joinRandom")];
            case 183:
                joinRandomInfo = _10.sent();
                return [4 /*yield*/, interaction.guild.channels.fetch(joinRandomInfo.discordChannelId)];
            case 184: return [4 /*yield*/, (_10.sent()).messages.fetch(joinRandomInfo.discordMessageId)];
            case 185:
                (_10.sent()).delete();
                clearObject(joinRandomInfo);
                // complete command
                return [4 /*yield*/, transaction.commit()];
            case 186:
                // complete command
                _10.sent();
                return [4 /*yield*/, message.channel.send("Cancelled join random request")];
            case 187:
                _10.sent();
                return [2 /*return*/];
            case 188:
                if (!(info.type === "workshopRole")) return [3 /*break*/, 195];
                return [4 /*yield*/, transaction.fetch("/workshop/" + info.workshopId)];
            case 189:
                workshop = _10.sent();
                if (!(interaction.customId === "add")) return [3 /*break*/, 192];
                return [4 /*yield*/, caller.roles.add(workshop.discordRoleId)];
            case 190:
                _10.sent();
                // complete command
                return [4 /*yield*/, transaction.commit()];
            case 191:
                // complete command
                _10.sent();
                return [2 /*return*/];
            case 192:
                if (!(interaction.customId === "remove")) return [3 /*break*/, 195];
                return [4 /*yield*/, caller.roles.remove(workshop.discordRoleId)];
            case 193:
                _10.sent();
                // complete command
                return [4 /*yield*/, transaction.commit()];
            case 194:
                // complete command
                _10.sent();
                return [2 /*return*/];
            case 195: return [3 /*break*/, 202];
            case 196:
                e_14 = _10.sent();
                console.error(e_14);
                _10.label = 197;
            case 197:
                _10.trys.push([197, 199, , 200]);
                return [4 /*yield*/, interaction.followUp("Oops, an internal error occurred: " + e_14)];
            case 198:
                _10.sent();
                return [3 /*break*/, 200];
            case 199:
                e_15 = _10.sent();
                return [3 /*break*/, 200];
            case 200: return [3 /*break*/, 202];
            case 201:
                running = false;
                return [7 /*endfinally*/];
            case 202: return [2 /*return*/];
        }
    });
}); });
// Process slash commands
client.on("interactionCreate", function (interaction) { return __awaiter(void 0, void 0, void 0, function () {
    var metadata, caller_1, subcommandName, key, _a, resource, properties, result, properties_1, properties_1_1, property, out, stringified, key, value, transaction, _b, resource, properties, last, result, properties_2, properties_2_1, property, v, v, teamName, member, transaction, user, team, teamName, transaction, team, teamMates, _c, _d, memberId, _e, _f, _g, _h, e_16_1, nextInteraction, _j, _k, e_17, _l, _m, memberId, _o, _p, e_18_1, teamName, newTeamName, transaction, team, workshopCode, transaction, workshop, channel, _q, _r, _s, memberId, member, user, team, teamVoiceChannel, e_19_1, workshopCode, workshopName, transaction, workshop, workshopsCategory, workshopsChannel, message, info, role, channelOptions, textChannel, voiceChannel, result, first, _t, _u, teamId, team, teamMates, _v, _w, memberId, _x, _y, _z, _0, e_20_1, e_21_1, result, first, _1, _2, workshopId, workshop, _3, _4, _5, e_22_1, workshopCode, removeFromDatastore, transaction, workshop, nextInteraction, _6, _7, e_23, _8, _9, role, textChannel, voiceChannel, _10, user, transaction, teamId, teamName, _11, pointsThisMonth, numMedals, parts, subcommandName, type, subcommandName, name, points, channel, points, e_24, e_25;
    var e_26, _12, e_27, _13, e_16, _14, e_18, _15, e_19, _16, e_21, _17, e_20, _18, e_22, _19;
    var _20, _21, _22, _23, _24, _25;
    var _26, _27, _28, _29, _30;
    return __generator(this, function (_31) {
        switch (_31.label) {
            case 0:
                if (!interaction.isCommand())
                    return [2 /*return*/];
                // defer reply cuz it might take a while maybe
                return [4 /*yield*/, interaction.deferReply()];
            case 1:
                // defer reply cuz it might take a while maybe
                _31.sent();
                _31.label = 2;
            case 2:
                _31.trys.push([2, 222, 227, 228]);
                if (!running) return [3 /*break*/, 4];
                return [4 /*yield*/, interaction.editReply("please try again later")];
            case 3:
                _31.sent();
                return [2 /*return*/];
            case 4:
                running = true;
                metadata = {
                    timestamp: Date.now(),
                    userDisplayName: interaction.user.username + "#" + interaction.user.discriminator,
                    userId: interaction.user.id,
                };
                assert(interaction.guild);
                assert(interaction.channel);
                if (!(interaction.commandName === "ping")) return [3 /*break*/, 6];
                return [4 /*yield*/, interaction.editReply("pong")];
            case 5:
                _31.sent();
                return [2 /*return*/];
            case 6:
                if (!(interaction.commandName === "admin")) return [3 /*break*/, 204];
                return [4 /*yield*/, interaction.guild.members.fetch(interaction.user.id)];
            case 7:
                caller_1 = _31.sent();
                if (!!caller_1.roles.cache.find(function (role) { return ["supervisor", "leader"].includes(role.name.toLowerCase()); })) return [3 /*break*/, 9];
                return [4 /*yield*/, interaction.editReply("You are not an admin")];
            case 8:
                _31.sent();
                return [2 /*return*/];
            case 9:
                subcommandName = interaction.options.getSubcommand(true);
                if (!(subcommandName === "get")) return [3 /*break*/, 14];
                if (!!caller_1.roles.cache.find(function (role) { return ["bot maintainer"].includes(role.name.toLowerCase()); })) return [3 /*break*/, 11];
                return [4 /*yield*/, interaction.editReply("You are not a bot maintainer")];
            case 10:
                _31.sent();
                return [2 /*return*/];
            case 11:
                key = interaction.options.getString("key", true);
                console.log(["admin", "get", key, metadata]);
                _a = __read(key.split(".")), resource = _a[0], properties = _a.slice(1);
                return [4 /*yield*/, resources.fetch(resource.trim())];
            case 12:
                result = _31.sent();
                try {
                    for (properties_1 = __values(properties), properties_1_1 = properties_1.next(); !properties_1_1.done; properties_1_1 = properties_1.next()) {
                        property = properties_1_1.value;
                        result = result === null || result === void 0 ? void 0 : result[property.trim()];
                    }
                }
                catch (e_26_1) { e_26 = { error: e_26_1 }; }
                finally {
                    try {
                        if (properties_1_1 && !properties_1_1.done && (_12 = properties_1.return)) _12.call(properties_1);
                    }
                    finally { if (e_26) throw e_26.error; }
                }
                out = void 0;
                if (result === undefined)
                    out = "*undefined*";
                else {
                    stringified = JSON.stringify(result, null, 2);
                    if (stringified.includes("\n"))
                        out = "```json\n" + stringified + "\n```";
                    else
                        out = "`" + stringified + "`";
                }
                return [4 /*yield*/, interaction.editReply(out)];
            case 13:
                _31.sent();
                return [2 /*return*/];
            case 14:
                if (!(subcommandName === "set")) return [3 /*break*/, 20];
                if (!!caller_1.roles.cache.find(function (role) { return ["bot maintainer"].includes(role.name.toLowerCase()); })) return [3 /*break*/, 16];
                return [4 /*yield*/, interaction.editReply("You are not a bot maintainer")];
            case 15:
                _31.sent();
                return [2 /*return*/];
            case 16:
                key = interaction.options.getString("key", true);
                value = interaction.options.getString("value", true);
                console.log(["admin", "set", key, value, metadata]);
                transaction = createTransaction(resources);
                _b = __read(key.split(".")), resource = _b[0], properties = _b.slice(1);
                last = properties.pop();
                return [4 /*yield*/, transaction.fetch(resource.trim())];
            case 17:
                result = _31.sent();
                try {
                    for (properties_2 = __values(properties), properties_2_1 = properties_2.next(); !properties_2_1.done; properties_2_1 = properties_2.next()) {
                        property = properties_2_1.value;
                        result = result === null || result === void 0 ? void 0 : result[property.trim()];
                    }
                }
                catch (e_27_1) { e_27 = { error: e_27_1 }; }
                finally {
                    try {
                        if (properties_2_1 && !properties_2_1.done && (_13 = properties_2.return)) _13.call(properties_2);
                    }
                    finally { if (e_27) throw e_27.error; }
                }
                if (result === undefined)
                    throw new Error("cannot set property of undefined");
                if (last === undefined) {
                    v = Object.assign({}, result);
                    clearObject(result);
                    Object.assign(result, eval("(" + value + ")"));
                }
                else {
                    v = result[last] === undefined ? undefined : JSON.parse(JSON.stringify(result[last]));
                    result[last] = eval("(" + value + ")");
                }
                return [4 /*yield*/, transaction.commit()];
            case 18:
                _31.sent();
                return [4 /*yield*/, interaction.editReply("*updated*")];
            case 19:
                _31.sent();
                return [2 /*return*/];
            case 20:
                if (!(subcommandName === "invalidate")) return [3 /*break*/, 23];
                console.log(["admin", "invalidate", metadata]);
                return [4 /*yield*/, resources.invalidate()];
            case 21:
                _31.sent();
                return [4 /*yield*/, interaction.editReply("*invalidated*")];
            case 22:
                _31.sent();
                return [2 /*return*/];
            case 23:
                if (!(subcommandName === "remove-from-team")) return [3 /*break*/, 36];
                teamName = interaction.options.getString("team-name", true);
                return [4 /*yield*/, interaction.guild.members.fetch(interaction.options.getUser("member", true).id)];
            case 24:
                member = _31.sent();
                console.log(["admin", "remove-from-team", teamName, member, metadata]);
                transaction = createTransaction(resources);
                return [4 /*yield*/, findUser(transaction, { discordUserId: member.id })];
            case 25:
                user = _31.sent();
                if (!(user == null)) return [3 /*break*/, 27];
                return [4 /*yield*/, interaction.editReply("User is not in a team")];
            case 26:
                _31.sent();
                return [2 /*return*/];
            case 27:
                if (!(user.teamId == null)) return [3 /*break*/, 29];
                return [4 /*yield*/, interaction.editReply("User is not in a team")];
            case 28:
                _31.sent();
                return [2 /*return*/];
            case 29: return [4 /*yield*/, fetchTeam(transaction, user.teamId)];
            case 30:
                team = _31.sent();
                if (!(team.name !== teamName)) return [3 /*break*/, 32];
                return [4 /*yield*/, interaction.editReply("User is in team called " + team.name + ", not " + teamName)];
            case 31:
                _31.sent();
                return [2 /*return*/];
            case 32: 
            // leave previous team
            return [4 /*yield*/, leaveTeam(interaction.guild, transaction, user)];
            case 33:
                // leave previous team
                _31.sent();
                // remove team if empty
                // if ((team.memberIds ?? []).length === 0) {
                // 	await destroyTeam(interaction.guild, transaction, team);
                // }
                // reply to interaction
                return [4 /*yield*/, transaction.commit()];
            case 34:
                // remove team if empty
                // if ((team.memberIds ?? []).length === 0) {
                // 	await destroyTeam(interaction.guild, transaction, team);
                // }
                // reply to interaction
                _31.sent();
                return [4 /*yield*/, interaction.editReply("Removed " + member + " from team " + teamName)];
            case 35:
                _31.sent();
                return [2 /*return*/];
            case 36:
                if (!(subcommandName === "delete-team")) return [3 /*break*/, 71];
                teamName = interaction.options.getString("team-name", true);
                console.log(["admin", "delete-team", teamName, metadata]);
                transaction = createTransaction(resources);
                return [4 /*yield*/, findTeam(transaction, { name: teamName })];
            case 37:
                team = _31.sent();
                if (!(team == null)) return [3 /*break*/, 39];
                return [4 /*yield*/, interaction.editReply("Team does not exist")];
            case 38:
                _31.sent();
                return [2 /*return*/];
            case 39:
                teamMates = [];
                _31.label = 40;
            case 40:
                _31.trys.push([40, 46, 47, 48]);
                _c = __values(team.memberIds), _d = _c.next();
                _31.label = 41;
            case 41:
                if (!!_d.done) return [3 /*break*/, 45];
                memberId = _d.value;
                _f = (_e = teamMates).push;
                _h = (_g = interaction.guild.members).fetch;
                return [4 /*yield*/, fetchUser(transaction, memberId)];
            case 42: return [4 /*yield*/, _h.apply(_g, [(_31.sent()).discordUserId])];
            case 43:
                _f.apply(_e, [_31.sent()]);
                _31.label = 44;
            case 44:
                _d = _c.next();
                return [3 /*break*/, 41];
            case 45: return [3 /*break*/, 48];
            case 46:
                e_16_1 = _31.sent();
                e_16 = { error: e_16_1 };
                return [3 /*break*/, 48];
            case 47:
                try {
                    if (_d && !_d.done && (_14 = _c.return)) _14.call(_c);
                }
                finally { if (e_16) throw e_16.error; }
                return [7 /*endfinally*/];
            case 48:
                ;
                // confirmation with a list of ppl in the team
                return [4 /*yield*/, interaction.editReply({
                        content: "Just to confirm, are you attempting to destroy team " + team.name + " with members " + teamMates.map(function (teamMate) { return teamMate.user.username; }).join(", ") + "?",
                        components: [
                            new discord_js_1.MessageActionRow().addComponents(new discord_js_1.MessageButton()
                                .setCustomId("yes")
                                .setLabel("Confirm")
                                .setStyle("SUCCESS"), new discord_js_1.MessageButton()
                                .setCustomId("no")
                                .setLabel("Cancel")
                                .setStyle("DANGER")),
                        ],
                    })];
            case 49:
                // confirmation with a list of ppl in the team
                _31.sent();
                nextInteraction = void 0;
                _31.label = 50;
            case 50:
                _31.trys.push([50, 54, , 55]);
                _k = (_j = interaction.channel.messages).fetch;
                return [4 /*yield*/, interaction.fetchReply()];
            case 51: return [4 /*yield*/, _k.apply(_j, [(_31.sent()).id])];
            case 52: return [4 /*yield*/, (_31.sent()).awaitMessageComponent({
                    filter: function (interaction) { return interaction.user.id === caller_1.id; },
                    time: 10000,
                })];
            case 53:
                nextInteraction = _31.sent();
                return [3 /*break*/, 55];
            case 54:
                e_17 = _31.sent();
                nextInteraction = undefined;
                return [3 /*break*/, 55];
            case 55:
                if (!(nextInteraction == null)) return [3 /*break*/, 57];
                return [4 /*yield*/, interaction.followUp({ content: "Confirmation timed out", components: [] })];
            case 56:
                _31.sent();
                return [2 /*return*/];
            case 57:
                if (!(nextInteraction.customId === "no")) return [3 /*break*/, 59];
                return [4 /*yield*/, interaction.followUp("Cancelled team destruction")];
            case 58:
                _31.sent();
                return [2 /*return*/];
            case 59:
                _31.trys.push([59, 65, 66, 67]);
                _l = __values(__spreadArray([], __read(team.memberIds), false)), _m = _l.next();
                _31.label = 60;
            case 60:
                if (!!_m.done) return [3 /*break*/, 64];
                memberId = _m.value;
                _o = leaveTeam;
                _p = [interaction.guild, transaction];
                return [4 /*yield*/, fetchUser(transaction, memberId)];
            case 61: return [4 /*yield*/, _o.apply(void 0, _p.concat([_31.sent()]))];
            case 62:
                _31.sent();
                _31.label = 63;
            case 63:
                _m = _l.next();
                return [3 /*break*/, 60];
            case 64: return [3 /*break*/, 67];
            case 65:
                e_18_1 = _31.sent();
                e_18 = { error: e_18_1 };
                return [3 /*break*/, 67];
            case 66:
                try {
                    if (_m && !_m.done && (_15 = _l.return)) _15.call(_l);
                }
                finally { if (e_18) throw e_18.error; }
                return [7 /*endfinally*/];
            case 67: return [4 /*yield*/, destroyTeam(interaction.guild, transaction, team)];
            case 68:
                _31.sent();
                // reply to interaction
                return [4 /*yield*/, transaction.commit()];
            case 69:
                // reply to interaction
                _31.sent();
                return [4 /*yield*/, interaction.followUp("Destroyed team " + teamName)];
            case 70:
                _31.sent();
                return [2 /*return*/];
            case 71:
                if (!(subcommandName === "rename-team")) return [3 /*break*/, 78];
                teamName = interaction.options.getString("team-name", true);
                newTeamName = interaction.options.getString("new-team-name", true);
                console.log(["admin", "rename-team", teamName, newTeamName, metadata]);
                transaction = createTransaction(resources);
                return [4 /*yield*/, findTeam(transaction, { name: teamName })];
            case 72:
                team = _31.sent();
                if (!(team == null)) return [3 /*break*/, 74];
                return [4 /*yield*/, interaction.editReply("Team does not exist")];
            case 73:
                _31.sent();
                return [2 /*return*/];
            case 74: 
            // rename team
            return [4 /*yield*/, renameTeam(interaction.guild, transaction, team, newTeamName)];
            case 75:
                // rename team
                _31.sent();
                // reply to interaction
                return [4 /*yield*/, transaction.commit()];
            case 76:
                // reply to interaction
                _31.sent();
                return [4 /*yield*/, interaction.editReply("Renamed " + teamName + " to " + newTeamName)];
            case 77:
                _31.sent();
                return [2 /*return*/];
            case 78:
                if (!(subcommandName === "move-to-breakout-rooms")) return [3 /*break*/, 97];
                workshopCode = interaction.options.getString("workshop-code", true);
                console.log(["admin", "move-to-breakout-rooms", workshopCode, metadata]);
                transaction = createTransaction(resources);
                return [4 /*yield*/, transaction.fetch("/workshop/" + workshopCode)];
            case 79:
                workshop = _31.sent();
                if (!(workshop.id == null)) return [3 /*break*/, 81];
                return [4 /*yield*/, interaction.editReply("Workshop does not exist")];
            case 80:
                _31.sent();
                return [2 /*return*/];
            case 81: return [4 /*yield*/, interaction.guild.channels.fetch(workshop.discordVoiceChannelId)];
            case 82:
                channel = _31.sent();
                assert(channel);
                _31.label = 83;
            case 83:
                _31.trys.push([83, 92, 93, 94]);
                _q = __values(channel.members.entries()), _r = _q.next();
                _31.label = 84;
            case 84:
                if (!!_r.done) return [3 /*break*/, 91];
                _s = __read(_r.value, 2), memberId = _s[0], member = _s[1];
                return [4 /*yield*/, findUser(transaction, { discordUserId: memberId })];
            case 85:
                user = _31.sent();
                if (user == null)
                    return [3 /*break*/, 90];
                if (user.teamId == null)
                    return [3 /*break*/, 90];
                return [4 /*yield*/, fetchTeam(transaction, user.teamId)];
            case 86:
                team = _31.sent();
                return [4 /*yield*/, interaction.guild.channels.fetch(team.discordVoiceChannelId)];
            case 87:
                teamVoiceChannel = _31.sent();
                return [4 /*yield*/, member.edit({ channel: teamVoiceChannel })];
            case 88:
                _31.sent();
                return [4 /*yield*/, sleep(250)];
            case 89:
                _31.sent(); // hopefully this is enough lol
                _31.label = 90;
            case 90:
                _r = _q.next();
                return [3 /*break*/, 84];
            case 91: return [3 /*break*/, 94];
            case 92:
                e_19_1 = _31.sent();
                e_19 = { error: e_19_1 };
                return [3 /*break*/, 94];
            case 93:
                try {
                    if (_r && !_r.done && (_16 = _q.return)) _16.call(_q);
                }
                finally { if (e_19) throw e_19.error; }
                return [7 /*endfinally*/];
            case 94: 
            // reply to interaction
            return [4 /*yield*/, transaction.commit()];
            case 95:
                // reply to interaction
                _31.sent();
                return [4 /*yield*/, interaction.editReply("Moved people who have a team into their voice channel")];
            case 96:
                _31.sent();
                return [2 /*return*/];
            case 97:
                if (!(subcommandName === "register-workshop")) return [3 /*break*/, 119];
                workshopCode = interaction.options.getString("workshop-code", true);
                workshopName = interaction.options.getString("workshop-name", true);
                console.log(["admin", "register-workshop", workshopCode, workshopName, metadata]);
                transaction = createTransaction(resources);
                if (!!/^[-a-z0-9]+$/g.test(workshopCode)) return [3 /*break*/, 99];
                return [4 /*yield*/, interaction.editReply("Workshop code can only have lowercase letters and dashes")];
            case 98:
                _31.sent();
                return [2 /*return*/];
            case 99: return [4 /*yield*/, transaction.fetch("/workshop/" + workshopCode)];
            case 100:
                workshop = _31.sent();
                if (!(workshop.id != null)) return [3 /*break*/, 102];
                return [4 /*yield*/, interaction.editReply("Workshop with same code exists")];
            case 101:
                _31.sent();
                return [2 /*return*/];
            case 102: return [4 /*yield*/, interaction.guild.channels.fetch()];
            case 103:
                workshopsCategory = (_31.sent()).find(function (channel) { return (channel instanceof discord_js_1.CategoryChannel
                    && channel.name.toLowerCase() === "workshops"); });
                if (!(workshopsCategory == null)) return [3 /*break*/, 105];
                return [4 /*yield*/, interaction.editReply("No workshops category exists")];
            case 104:
                _31.sent();
                return [2 /*return*/];
            case 105: return [4 /*yield*/, interaction.guild.channels.fetch()];
            case 106:
                workshopsChannel = (_31.sent()).find(function (channel) { return (channel instanceof discord_js_1.TextChannel
                    && channel.name.toLowerCase() === "workshops"); });
                if (!(workshopsChannel == null)) return [3 /*break*/, 108];
                return [4 /*yield*/, interaction.editReply("No workshops channel exists")];
            case 107:
                _31.sent();
                return [2 /*return*/];
            case 108: return [4 /*yield*/, transaction.fetch("/workshops")];
            case 109:
                // create workshop
                ((_20 = (_26 = (_31.sent())).ids) !== null && _20 !== void 0 ? _20 : (_26.ids = [])).push(workshopCode);
                workshop.id = workshopCode;
                workshop.name = workshopName;
                workshop.hostDiscordUserId = interaction.user.id;
                return [4 /*yield*/, workshopsChannel.send(".")];
            case 110:
                message = _31.sent();
                return [4 /*yield*/, transaction.fetch("/interactions")];
            case 111:
                ((_21 = (_27 = (_31.sent())).interactionIds) !== null && _21 !== void 0 ? _21 : (_27.interactionIds = [])).push(message.id);
                return [4 /*yield*/, transaction.fetch("/interaction/" + message.id)];
            case 112:
                info = _31.sent();
                Object.assign(info, {
                    id: message.id,
                    type: "workshopRole",
                    workshopId: workshop.id,
                });
                workshop.interactionId = message.id;
                return [4 /*yield*/, interaction.guild.roles.create({ name: "" + workshopName })];
            case 113:
                role = _31.sent();
                workshop.discordRoleId = role.id;
                channelOptions = { parent: workshopsCategory };
                return [4 /*yield*/, interaction.guild.channels.create("" + workshopName, __assign({}, channelOptions))];
            case 114:
                textChannel = _31.sent();
                return [4 /*yield*/, interaction.guild.channels.create("" + workshopName, __assign({ type: "GUILD_VOICE" }, channelOptions))];
            case 115:
                voiceChannel = _31.sent();
                workshop.discordTextChannelId = textChannel.id;
                workshop.discordVoiceChannelId = voiceChannel.id;
                // reply to interaction
                return [4 /*yield*/, transaction.commit()];
            case 116:
                // reply to interaction
                _31.sent();
                return [4 /*yield*/, interaction.editReply("Created workshop")];
            case 117:
                _31.sent();
                return [4 /*yield*/, message.edit({
                        content: "Workshop: " + workshopName + " by " + interaction.user + " (code: " + workshopCode + "). Press the button before to get the workshop role. (The host will ping this role for workshop specific announcements.)",
                        components: [
                            new discord_js_1.MessageActionRow().addComponents(new discord_js_1.MessageButton()
                                .setCustomId("add")
                                .setLabel("Add " + workshopCode + " role")
                                .setStyle("SUCCESS"), new discord_js_1.MessageButton()
                                .setCustomId("remove")
                                .setLabel("Remove " + workshopCode + " role")
                                .setStyle("DANGER")),
                        ]
                    })];
            case 118:
                _31.sent();
                return [2 /*return*/];
            case 119:
                if (!(subcommandName === "list-all-teams")) return [3 /*break*/, 149];
                console.log(["admin", "list-all-teams", metadata]);
                result = [];
                first = true;
                _31.label = 120;
            case 120:
                _31.trys.push([120, 139, 140, 141]);
                return [4 /*yield*/, fetchTeams(resources)];
            case 121:
                _t = __values.apply(void 0, [(_31.sent()).teamIds]), _u = _t.next();
                _31.label = 122;
            case 122:
                if (!!_u.done) return [3 /*break*/, 138];
                teamId = _u.value;
                return [4 /*yield*/, fetchTeam(resources, teamId)];
            case 123:
                team = _31.sent();
                teamMates = [];
                _31.label = 124;
            case 124:
                _31.trys.push([124, 130, 131, 132]);
                _v = (e_20 = void 0, __values(team.memberIds)), _w = _v.next();
                _31.label = 125;
            case 125:
                if (!!_w.done) return [3 /*break*/, 129];
                memberId = _w.value;
                _y = (_x = teamMates).push;
                _0 = (_z = interaction.guild.members).fetch;
                return [4 /*yield*/, fetchUser(resources, memberId)];
            case 126: return [4 /*yield*/, _0.apply(_z, [(_31.sent()).discordUserId])];
            case 127:
                _y.apply(_x, [_31.sent()]);
                _31.label = 128;
            case 128:
                _w = _v.next();
                return [3 /*break*/, 125];
            case 129: return [3 /*break*/, 132];
            case 130:
                e_20_1 = _31.sent();
                e_20 = { error: e_20_1 };
                return [3 /*break*/, 132];
            case 131:
                try {
                    if (_w && !_w.done && (_18 = _v.return)) _18.call(_v);
                }
                finally { if (e_20) throw e_20.error; }
                return [7 /*endfinally*/];
            case 132:
                ;
                result.push("Team " + team.name + " with ID " + team.id + " and members " + teamMates.map(function (member) { return member.user.username; }).join(", "));
                if (!(result.length >= 8)) return [3 /*break*/, 137];
                if (!first) return [3 /*break*/, 134];
                return [4 /*yield*/, interaction.editReply(result.join("\n"))];
            case 133:
                _31.sent();
                first = false;
                return [3 /*break*/, 136];
            case 134: return [4 /*yield*/, interaction.followUp(result.join("\n"))];
            case 135:
                _31.sent();
                _31.label = 136;
            case 136:
                result.splice(0, result.length);
                _31.label = 137;
            case 137:
                _u = _t.next();
                return [3 /*break*/, 122];
            case 138: return [3 /*break*/, 141];
            case 139:
                e_21_1 = _31.sent();
                e_21 = { error: e_21_1 };
                return [3 /*break*/, 141];
            case 140:
                try {
                    if (_u && !_u.done && (_17 = _t.return)) _17.call(_t);
                }
                finally { if (e_21) throw e_21.error; }
                return [7 /*endfinally*/];
            case 141:
                if (!(result.length > 0)) return [3 /*break*/, 146];
                if (!first) return [3 /*break*/, 143];
                return [4 /*yield*/, interaction.editReply(result.join("\n"))];
            case 142:
                _31.sent();
                return [3 /*break*/, 145];
            case 143: return [4 /*yield*/, interaction.followUp(result.join("\n"))];
            case 144:
                _31.sent();
                _31.label = 145;
            case 145: return [3 /*break*/, 148];
            case 146:
                if (!first) return [3 /*break*/, 148];
                return [4 /*yield*/, interaction.editReply("no teams :/")];
            case 147:
                _31.sent();
                _31.label = 148;
            case 148: return [2 /*return*/];
            case 149:
                if (!(subcommandName === "list-all-workshops")) return [3 /*break*/, 171];
                console.log(["admin", "list-all-workshops", metadata]);
                result = [];
                first = true;
                _31.label = 150;
            case 150:
                _31.trys.push([150, 161, 162, 163]);
                return [4 /*yield*/, resources.fetch("/workshops")];
            case 151:
                _1 = __values.apply(void 0, [(_22 = (_28 = (_31.sent())).ids) !== null && _22 !== void 0 ? _22 : (_28.ids = [])]), _2 = _1.next();
                _31.label = 152;
            case 152:
                if (!!_2.done) return [3 /*break*/, 160];
                workshopId = _2.value;
                return [4 /*yield*/, resources.fetch("/workshop/" + workshopId)];
            case 153:
                workshop = _31.sent();
                _4 = (_3 = result).push;
                _5 = workshop.name + " with code " + workshop.id + " hosted by ";
                return [4 /*yield*/, interaction.guild.members.fetch(workshop.hostDiscordUserId)];
            case 154:
                _4.apply(_3, [_5 + (_31.sent()).user.username]);
                if (!(result.length >= 8)) return [3 /*break*/, 159];
                if (!first) return [3 /*break*/, 156];
                return [4 /*yield*/, interaction.editReply(result.join("\n"))];
            case 155:
                _31.sent();
                first = false;
                return [3 /*break*/, 158];
            case 156: return [4 /*yield*/, interaction.followUp(result.join("\n"))];
            case 157:
                _31.sent();
                _31.label = 158;
            case 158:
                result.splice(0, result.length);
                _31.label = 159;
            case 159:
                _2 = _1.next();
                return [3 /*break*/, 152];
            case 160: return [3 /*break*/, 163];
            case 161:
                e_22_1 = _31.sent();
                e_22 = { error: e_22_1 };
                return [3 /*break*/, 163];
            case 162:
                try {
                    if (_2 && !_2.done && (_19 = _1.return)) _19.call(_1);
                }
                finally { if (e_22) throw e_22.error; }
                return [7 /*endfinally*/];
            case 163:
                if (!(result.length > 0)) return [3 /*break*/, 168];
                if (!first) return [3 /*break*/, 165];
                return [4 /*yield*/, interaction.editReply(result.join("\n"))];
            case 164:
                _31.sent();
                return [3 /*break*/, 167];
            case 165: return [4 /*yield*/, interaction.followUp(result.join("\n"))];
            case 166:
                _31.sent();
                _31.label = 167;
            case 167: return [3 /*break*/, 170];
            case 168:
                if (!first) return [3 /*break*/, 170];
                return [4 /*yield*/, interaction.editReply("no workshops :/")];
            case 169:
                _31.sent();
                _31.label = 170;
            case 170: return [2 /*return*/];
            case 171:
                if (!(subcommandName === "delete-workshop")) return [3 /*break*/, 204];
                workshopCode = interaction.options.getString("workshop-code", true);
                removeFromDatastore = (_23 = interaction.options.getBoolean("remove-from-datastore", false)) !== null && _23 !== void 0 ? _23 : false;
                console.log(["admin", "delete-workshop", workshopCode, metadata]);
                transaction = createTransaction(resources);
                return [4 /*yield*/, transaction.fetch("/workshop/" + workshopCode)];
            case 172:
                workshop = _31.sent();
                if (!(workshop.id == null)) return [3 /*break*/, 174];
                return [4 /*yield*/, interaction.editReply("Workshop does not exist")];
            case 173:
                _31.sent();
                return [2 /*return*/];
            case 174: 
            // confirmation
            return [4 /*yield*/, interaction.editReply({
                    content: "Just to confirm, are you attempting to destroy " + workshop.name + " with code " + workshop.id,
                    components: [
                        new discord_js_1.MessageActionRow().addComponents(new discord_js_1.MessageButton()
                            .setCustomId("yes")
                            .setLabel("Confirm")
                            .setStyle("SUCCESS"), new discord_js_1.MessageButton()
                            .setCustomId("no")
                            .setLabel("Cancel")
                            .setStyle("DANGER")),
                    ],
                })];
            case 175:
                // confirmation
                _31.sent();
                nextInteraction = void 0;
                _31.label = 176;
            case 176:
                _31.trys.push([176, 180, , 181]);
                _7 = (_6 = interaction.channel.messages).fetch;
                return [4 /*yield*/, interaction.fetchReply()];
            case 177: return [4 /*yield*/, _7.apply(_6, [(_31.sent()).id])];
            case 178: return [4 /*yield*/, (_31.sent()).awaitMessageComponent({
                    filter: function (interaction) { return interaction.user.id === caller_1.id; },
                    time: 10000,
                })];
            case 179:
                nextInteraction = _31.sent();
                return [3 /*break*/, 181];
            case 180:
                e_23 = _31.sent();
                nextInteraction = undefined;
                return [3 /*break*/, 181];
            case 181:
                if (!(nextInteraction == null)) return [3 /*break*/, 183];
                return [4 /*yield*/, interaction.editReply({ content: "Confirmation timed out", components: [] })];
            case 182:
                _31.sent();
                return [2 /*return*/];
            case 183:
                if (!(nextInteraction.customId === "no")) return [3 /*break*/, 185];
                return [4 /*yield*/, interaction.followUp("Cancelled workshop destruction")];
            case 184:
                _31.sent();
                return [2 /*return*/];
            case 185:
                if (!workshop.interactionId) return [3 /*break*/, 188];
                _8 = removeFromArray;
                return [4 /*yield*/, transaction.fetch("/interactions")];
            case 186:
                _8.apply(void 0, [(_24 = (_29 = (_31.sent())).ids) !== null && _24 !== void 0 ? _24 : (_29.ids = []), workshop.interactionId]);
                _9 = clearObject;
                return [4 /*yield*/, transaction.fetch("/interaction/" + workshop.interactionId)];
            case 187:
                _9.apply(void 0, [_31.sent()]);
                _31.label = 188;
            case 188:
                if (!workshop.discordRoleId) return [3 /*break*/, 191];
                return [4 /*yield*/, interaction.guild.roles.fetch(workshop.discordRoleId)];
            case 189:
                role = _31.sent();
                assert(role);
                return [4 /*yield*/, role.delete()];
            case 190:
                _31.sent();
                _31.label = 191;
            case 191:
                if (!workshop.discordTextChannelId) return [3 /*break*/, 194];
                return [4 /*yield*/, interaction.guild.channels.fetch(workshop.discordTextChannelId)];
            case 192:
                textChannel = _31.sent();
                assert(textChannel);
                return [4 /*yield*/, textChannel.delete()];
            case 193:
                _31.sent();
                _31.label = 194;
            case 194:
                if (!workshop.discordVoiceChannelId) return [3 /*break*/, 197];
                return [4 /*yield*/, interaction.guild.channels.fetch(workshop.discordVoiceChannelId)];
            case 195:
                voiceChannel = _31.sent();
                assert(voiceChannel);
                return [4 /*yield*/, voiceChannel.delete()];
            case 196:
                _31.sent();
                _31.label = 197;
            case 197:
                if (!removeFromDatastore) return [3 /*break*/, 201];
                _10 = removeFromArray;
                return [4 /*yield*/, transaction.fetch("/workshops")];
            case 198:
                _10.apply(void 0, [(_25 = (_30 = (_31.sent())).ids) !== null && _25 !== void 0 ? _25 : (_30.ids = []), workshop.id]);
                clearObject(workshop);
                // reply to interaction
                return [4 /*yield*/, transaction.commit()];
            case 199:
                // reply to interaction
                _31.sent();
                return [4 /*yield*/, interaction.followUp("Destroyed workshop " + workshopCode + " and removed it from the datastore")];
            case 200:
                _31.sent();
                return [2 /*return*/];
            case 201: 
            // reply to interaction
            return [4 /*yield*/, transaction.commit()];
            case 202:
                // reply to interaction
                _31.sent();
                return [4 /*yield*/, interaction.followUp("Destroyed workshop " + workshopCode)];
            case 203:
                _31.sent();
                return [2 /*return*/];
            case 204:
                if (!(interaction.commandName === "profile")) return [3 /*break*/, 212];
                console.log(["profile", metadata]);
                return [4 /*yield*/, findUser(resources, { discordUserId: interaction.user.id })];
            case 205:
                user = _31.sent();
                if (!!user) return [3 /*break*/, 208];
                transaction = createTransaction(resources);
                return [4 /*yield*/, createUser(interaction.guild, transaction, { id: interaction.id, discordUserId: interaction.user.id })];
            case 206:
                user = _31.sent();
                return [4 /*yield*/, transaction.commit()];
            case 207:
                _31.sent();
                _31.label = 208;
            case 208:
                teamId = user.teamId;
                _11 = teamId;
                if (!_11) return [3 /*break*/, 210];
                return [4 /*yield*/, fetchTeam(resources, teamId)];
            case 209:
                _11 = (_31.sent()).name;
                _31.label = 210;
            case 210:
                teamName = _11;
                pointsThisMonth = 0;
                numMedals = 0;
                parts = [];
                parts.push("Summary for " + metadata.userDisplayName);
                if (teamId)
                    parts.push("- Team: " + teamName);
                parts.push("- Points this month: " + pointsThisMonth);
                parts.push("- Medals: " + numMedals);
                // send response
                return [4 /*yield*/, interaction.editReply({ content: parts.join("\n"), allowedMentions: { parse: [] } })];
            case 211:
                // send response
                _31.sent();
                return [2 /*return*/];
            case 212:
                if (!(interaction.commandName === "team")) return [3 /*break*/, 214];
                subcommandName = interaction.options.getSubcommand(true);
                if (!(subcommandName in teamFunctions)) return [3 /*break*/, 214];
                return [4 /*yield*/, teamFunctions[subcommandName](interaction, metadata)];
            case 213:
                _31.sent();
                return [2 /*return*/];
            case 214:
                if (!(interaction.commandName === "leaderboard")) return [3 /*break*/, 216];
                type = interaction.options.getString("type") || "normal";
                return [4 /*yield*/, interaction.editReply("haha lol leaderboard")];
            case 215:
                _31.sent();
                return [2 /*return*/];
            case 216:
                if (!(interaction.commandName === "points")) return [3 /*break*/, 220];
                subcommandName = interaction.options.getSubcommand(true);
                if (!(subcommandName === "give-team")) return [3 /*break*/, 218];
                name = interaction.options.getString("name", true);
                points = interaction.options.getInteger("points", true);
                return [4 /*yield*/, interaction.editReply("haha lol points give-team " + name + " " + points)];
            case 217:
                _31.sent();
                return [2 /*return*/];
            case 218:
                if (!(subcommandName === "give-voice")) return [3 /*break*/, 220];
                channel = interaction.options.getString("channel", true);
                points = interaction.options.getInteger("points", true);
                return [4 /*yield*/, interaction.editReply("haha lol points give-voice " + channel + " " + points)];
            case 219:
                _31.sent();
                return [2 /*return*/];
            case 220: 
            // fallback when command aint implemented
            return [4 /*yield*/, interaction.editReply("not implemented yet lol")];
            case 221:
                // fallback when command aint implemented
                _31.sent();
                return [3 /*break*/, 228];
            case 222:
                e_24 = _31.sent();
                console.error(e_24);
                _31.label = 223;
            case 223:
                _31.trys.push([223, 225, , 226]);
                return [4 /*yield*/, interaction.editReply("Oops, an internal error occurred: " + e_24)];
            case 224:
                _31.sent();
                return [3 /*break*/, 226];
            case 225:
                e_25 = _31.sent();
                return [3 /*break*/, 226];
            case 226: return [3 /*break*/, 228];
            case 227:
                running = false;
                return [7 /*endfinally*/];
            case 228: return [2 /*return*/];
        }
    });
}); });
client.login(process.env.BOT_TOKEN);
//# sourceMappingURL=index.js.map