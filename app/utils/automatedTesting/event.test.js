import Event from "../eventFramework";

test("Event default constructor title", () => {
const e = new Event();
expect(e.getSummary()).toBe("Event Name");
});

test("Event set new title", () => {
    const nameMe =  new Event();
    nameMe.setSummary("Look outside")
    expect(nameMe.getSummary()).toBe("Look outside");
});

test("Event set new description", () => {
    const describeMe =  new Event();
    describeMe.setDescription("Make contact with the visitor, you know you want to.")
    expect(describeMe.getDescription()).toBe("Make contact with the visitor, you know you want to.");
});

test("Event set new location", () => {
    const locateMe =  new Event();
    locateMe.setLocation("Montreal")
    expect(locateMe.getLocation()).toBe("Montreal");
});

describe("Event set new status", () => {
    test.each([
        ["CANCELLED", "CANCELLED"],
        ["CONFIRMED", "CONFIRMED"],
        ["TENTATIVE", "TENTATIVE"],

    ])("setStatus alternates between three possibilities", (input, expected)=>{
    const statusMe =  new Event();
    statusMe.setStatus(input)
    expect(statusMe.getStatus()).toBe(expected);
    
    });
});