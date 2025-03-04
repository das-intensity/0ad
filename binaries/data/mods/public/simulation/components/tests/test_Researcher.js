Engine.RegisterGlobal("Resources", {
	"BuildSchema": (a, b) => {}
});
Engine.LoadHelperScript("Player.js");
Engine.LoadComponentScript("interfaces/TechnologyManager.js");
Engine.LoadComponentScript("interfaces/Researcher.js");
Engine.LoadComponentScript("Researcher.js");

Engine.RegisterGlobal("ApplyValueModificationsToEntity", (_, value) => value);

const playerID = 1;
const playerEntityID = 11;
const entityID = 21;

Engine.RegisterGlobal("TechnologyTemplates", {
	"Has": name => name == "phase_town_athen" || name == "phase_city_athen",
	"Get": () => ({})
});

AddMock(SYSTEM_ENTITY, IID_PlayerManager, {
	"GetPlayerByID": id => playerEntityID
});

AddMock(playerEntityID, IID_Player, {
	"GetCiv": () => "iber",
	"GetDisabledTechnologies": () => ({})
});

AddMock(playerEntityID, IID_TechnologyManager, {
	"CheckTechnologyRequirements": () => true,
	"IsInProgress": () => false,
	"IsTechnologyResearched": () => false
});

AddMock(entityID, IID_Ownership, {
	"GetOwner": () => playerID
});

AddMock(entityID, IID_Identity, {
	"GetCiv": () => "iber"
});

const cmpResearcher = ConstructComponent(entityID, "Researcher", {
	"Technologies": { "_string": "gather_fishing_net " +
	                             "phase_town_{civ} " +
	                             "phase_city_{civ}" }
});

TS_ASSERT_UNEVAL_EQUALS(
	cmpResearcher.GetTechnologiesList(),
	["gather_fishing_net", "phase_town_generic", "phase_city_generic"]
);

AddMock(playerEntityID, IID_Player, {
	"GetCiv": () => "athen",
	"GetDisabledTechnologies": () => ({ "gather_fishing_net": true })
});
TS_ASSERT_UNEVAL_EQUALS(cmpResearcher.GetTechnologiesList(), ["phase_town_athen", "phase_city_athen"]);

AddMock(playerEntityID, IID_TechnologyManager, {
	"CheckTechnologyRequirements": () => true,
	"IsInProgress": () => false,
	"IsTechnologyResearched": tech => tech == "phase_town_athen"
});
TS_ASSERT_UNEVAL_EQUALS(cmpResearcher.GetTechnologiesList(), [undefined, "phase_city_athen"]);

AddMock(playerEntityID, IID_Player, {
	"GetCiv": () => "iber",
	"GetDisabledTechnologies": () => ({})
});
TS_ASSERT_UNEVAL_EQUALS(
	cmpResearcher.GetTechnologiesList(),
	["gather_fishing_net", "phase_town_generic", "phase_city_generic"]
);

Engine.RegisterGlobal("ApplyValueModificationsToEntity", (_, value) => value + " some_test");
TS_ASSERT_UNEVAL_EQUALS(
	cmpResearcher.GetTechnologiesList(),
	["gather_fishing_net", "phase_town_generic", "phase_city_generic", "some_test"]
);


// Test Queuing a tech.
const queuedTech = "gather_fishing_net";
const cost = {
	"food": 10
};
Engine.RegisterGlobal("TechnologyTemplates", {
	"Has": () => true,
	"Get": () => ({
		"cost": cost,
		"researchTime": 1
	})
});

const cmpPlayer = AddMock(playerEntityID, IID_Player, {
	"GetCiv": () => "iber",
	"GetDisabledTechnologies": () => ({}),
	"GetPlayerID": () => playerID,
	"TrySubtractResources": (resources) => {
		TS_ASSERT_UNEVAL_EQUALS(resources, cost);
		// Just have enough resources.
		return true;
	},
	"RefundResources": (resources) => {
		TS_ASSERT_UNEVAL_EQUALS(resources, cost);
	},
});
let spyCmpPlayer = new Spy(cmpPlayer, "TrySubtractResources");
const techManager = AddMock(playerEntityID, IID_TechnologyManager, {
	"CheckTechnologyRequirements": () => true,
	"IsInProgress": () => false,
	"IsTechnologyResearched": () => false,
	"QueuedResearch": (templateName, researcher) => {
		TS_ASSERT_UNEVAL_EQUALS(templateName, queuedTech);
		TS_ASSERT_UNEVAL_EQUALS(researcher, entityID);
	},
	"StoppedResearch": (templateName, _) => {
		TS_ASSERT_UNEVAL_EQUALS(templateName, queuedTech);
	},
	"StartedResearch": (templateName, _) => {
		TS_ASSERT_UNEVAL_EQUALS(templateName, queuedTech);
	},
	"ResearchTechnology": (templateName, _) => {
		TS_ASSERT_UNEVAL_EQUALS(templateName, queuedTech);
	}
});
let spyTechManager = new Spy(techManager, "QueuedResearch");
let id = cmpResearcher.QueueTechnology(queuedTech);
TS_ASSERT_EQUALS(spyTechManager._called, 1);
TS_ASSERT_EQUALS(spyCmpPlayer._called, 1);
TS_ASSERT_EQUALS(cmpResearcher.queue.size, 1);


// Test removing a queued tech.
spyCmpPlayer = new Spy(cmpPlayer, "RefundResources");
spyTechManager = new Spy(techManager, "StoppedResearch");
cmpResearcher.StopResearching(id);
TS_ASSERT_EQUALS(spyTechManager._called, 1);
TS_ASSERT_EQUALS(spyCmpPlayer._called, 1);
TS_ASSERT_EQUALS(cmpResearcher.queue.size, 0);


// Test finishing a queued tech.
id = cmpResearcher.QueueTechnology(queuedTech);
TS_ASSERT_EQUALS(cmpResearcher.GetResearchingTechnology(id).progress, 0);
TS_ASSERT_EQUALS(cmpResearcher.Progress(id, 500), 500);
TS_ASSERT_EQUALS(cmpResearcher.GetResearchingTechnology(id).progress, 0.5);

spyTechManager = new Spy(techManager, "ResearchTechnology");
TS_ASSERT_EQUALS(cmpResearcher.Progress(id, 1000), 500);
TS_ASSERT_EQUALS(spyTechManager._called, 1);
TS_ASSERT_EQUALS(cmpResearcher.queue.size, 0);


// Test that we can affect an empty researcher.
Engine.RegisterGlobal("ApplyValueModificationsToEntity", (_, value) => value + "some_test");
TS_ASSERT_UNEVAL_EQUALS(
	ConstructComponent(entityID, "Researcher", null).GetTechnologiesList(),
	["some_test"]
);
