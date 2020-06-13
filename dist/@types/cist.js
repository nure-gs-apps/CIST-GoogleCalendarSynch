"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const change_case_1 = require("change-case");
var EntityType;
(function (EntityType) {
    EntityType["Events"] = "events";
    EntityType["Groups"] = "groups";
    EntityType["Rooms"] = "rooms";
})(EntityType = exports.EntityType || (exports.EntityType = {}));
class ThrowCistJsonClient {
    constructor() {
    }
    static getInstance() {
        if (!this._getInstance) {
            this._getInstance = new ThrowCistJsonClient();
        }
        return this._getInstance;
    }
    getEventsResponse(type, entityId, dateLimits) {
        throw new TypeError('Cist Json Client is not found');
    }
    getGroupsResponse() {
        throw new TypeError('Cist Json Client is not found');
    }
    getRoomsResponse() {
        throw new TypeError('Cist Json Client is not found');
    }
}
exports.ThrowCistJsonClient = ThrowCistJsonClient;
Object.defineProperty(ThrowCistJsonClient, "_getInstance", {
    enumerable: true,
    configurable: true,
    writable: true,
    value: null
});
var EventType;
(function (EventType) {
    EventType[EventType["Lecture"] = 0] = "Lecture";
    EventType[EventType["ExtramuralInitialLecture"] = 1] = "ExtramuralInitialLecture";
    EventType[EventType["TermInitialLecture"] = 2] = "TermInitialLecture";
    EventType[EventType["Practice"] = 10] = "Practice";
    EventType[EventType["Seminar"] = 11] = "Seminar";
    EventType[EventType["ExtramuralPractice"] = 12] = "ExtramuralPractice";
    EventType[EventType["LabWork"] = 20] = "LabWork";
    EventType[EventType["ComputerCenterLabWork"] = 21] = "ComputerCenterLabWork";
    EventType[EventType["DirectionLabWork"] = 22] = "DirectionLabWork";
    EventType[EventType["InitialLabWork"] = 23] = "InitialLabWork";
    EventType[EventType["InitialDirectionLabWork"] = 24] = "InitialDirectionLabWork";
    EventType[EventType["Consultation"] = 30] = "Consultation";
    EventType[EventType["VoluntaryConsultation"] = 31] = "VoluntaryConsultation";
    EventType[EventType["Test"] = 40] = "Test";
    EventType[EventType["DifferentiatedTest"] = 41] = "DifferentiatedTest";
    EventType[EventType["Exam"] = 50] = "Exam";
    EventType[EventType["WrittenExam"] = 51] = "WrittenExam";
    EventType[EventType["OralExam"] = 52] = "OralExam";
    EventType[EventType["CompositeExam"] = 53] = "CompositeExam";
    EventType[EventType["TestExam"] = 54] = "TestExam";
    EventType[EventType["ModularExam"] = 55] = "ModularExam";
    EventType[EventType["CourseWork"] = 60] = "CourseWork";
})(EventType = exports.EventType || (exports.EventType = {}));
function asReadableType(type) {
    return change_case_1.capitalCase(EventType[type]);
}
exports.asReadableType = asReadableType;
var TimetableType;
(function (TimetableType) {
    TimetableType[TimetableType["Group"] = 1] = "Group";
    TimetableType[TimetableType["Teacher"] = 2] = "Teacher";
    TimetableType[TimetableType["Room"] = 3] = "Room";
})(TimetableType = exports.TimetableType || (exports.TimetableType = {}));
//# sourceMappingURL=cist.js.map