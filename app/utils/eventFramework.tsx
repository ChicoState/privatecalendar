/*class for events to work across the entire app hopefully. Ideally stores all necessary information from .ics format
and allows it to be used elsewhere.
*/

export default class Event {
    // Variables directly follow .ics format

    private type!: "VEVENT" | "VTODO" // can only be one of two things
    private uid!: string; //unique identifier for event
    private DTStamp!: Date; //when the event was last modified
    private DTstart!: string;//when the event begins
    private DTend!: string;//when the event ends
    private summary!: string; //title of the even, e.x. "Trevor's Bday"
    private description?: string; //event details, e.x. "Bring cake"
    private location?: string;//where the event occurs.
    private status?: "CONFIRMED" | "CANCELLED" | "TENTATIVE"; //status can only be one of three things.
    private statusTODO?: "NEEDS-ACTION" | "COMPLETED" | "IN-PROCESS" | "CANCELLED" // can only be on of four things
    private priority: number = 0;
    private rRule?: string; //used to set event frequency e.x. "FREQ=WEEKLY;BYDAY=MO".
    private attendees?: string[]; //list of attendees.
    private creator!: string; //name of event creator.

    defconstructor(){
        this.type = "VEVENT"
        this.uid = `${Date.now()}`;
        this.DTStamp = new Date(); //set current timestamp on creation
        this.DTstart = "TZID=America/New_York:20130802T103400";
        this.DTend = "TZID=America/New_York:20130802T110400";
        this.summary = "Event Name";
        this.creator = "Sam";
        this.description = "This is a test description";
        this.location = "Somewhere";
        this.status = "TENTATIVE";
        this.statusTODO = "NEEDS-ACTION";
        this.priority = 0;
        this.rRule = "";
        this.attendees = ["Dan", "Hellen", "Phillipe", "Aubrey", "Leigh", "Lyle"];
    }

    constructor(
        type: "VEVENT" | "VTODO",
        id: string,  
        Start: string, 
        End: string, 
        Sum: string,    
        founder: string,
        desc?: string,
        loc?: string,
        stat?:"CONFIRMED" | "CANCELLED" | "TENTATIVE",
        statTODO?: "NEEDS-ACTION" | "COMPLETED" | "IN-PROCESS" | "CANCELLED",
        priority: number = 0,
        recur?: string,
        participantList?: string[],
        )
    {
        //required values
        //Creates a random UID for the event, current date + random number
        this.type = type
        this.uid = `${Date.now()}`;
        this.DTStamp = new Date(); //set current timestamp on creation
        this.DTstart = Start;
        this.DTend = End;
        this.summary = Sum;
        this.creator = founder;

        // optional values

        this.description = desc;
        this.location = loc;
        this.status = stat;
        this.statusTODO = statTODO
        this.priority = priority
        this.rRule = recur;
        this.attendees = participantList;
    }

    /* Getters */

    public getType(): "VEVENT" | "VTODO" | undefined {
        return this.type
    }

    public getUid(): string {
        return this.uid;
    }

    public getDTStamp(): Date {
        return this.DTStamp;
    }

    public getDTstart(): string {
        return this.DTstart;
    }

    public getDTend(): string {
        return this.DTend;
    }

    public getSummary(): string {
        return this.summary;
    }

    public getDescription(): string | undefined {
        return this.description;
    }
    
    public getLocation(): string | undefined {
        return this.location;
    }

    public getStatus(): "CONFIRMED" | "CANCELLED" | "TENTATIVE" | undefined {
        return this.status;
    }

    public getStatusTODO(): "NEEDS-ACTION" | "COMPLETED" | "IN-PROCESS" | "CANCELLED" | undefined {
        return this.statusTODO;
    }

    public getPriority(): number {
        return this.priority;
    }
    
    public getRRule(): string | undefined {
        return this.rRule;
    }

    public getAttendees(): string[] | undefined {
        return this.attendees;
    }

    public getCreator(): string {
        return this.creator;
    }

    /* Setters */
    
    public setDTStamp(stamp: Date): void {
        this.DTStamp = stamp;
    }

    public setDTstart(Start: string): void {
        this.DTstart = Start;
        this.setDTStamp(new Date());
    }

    public setDTend(End: string): void {
        this.DTend = End;
        this.setDTStamp(new Date());
    }

    public setSummary(Sum: string): void {
        this.summary = Sum;
        this.setDTStamp(new Date());
    }

    public setDescription(Desc: string | undefined): void {
        this.description = Desc;
        this.setDTStamp(new Date());
    }
    
    public setLocation(Loc: string | undefined): void {
        this.location = Loc;
        this.setDTStamp(new Date());
    }

    public setStatus(Stat: "CONFIRMED" | "CANCELLED" | "TENTATIVE"): void {
        this.status = Stat;
        this.setDTStamp(new Date());
    }

    public setStatusTODO(Stat: "NEEDS-ACTION" | "COMPLETED" | "IN-PROCESS" | "CANCELLED"): void {
        this.statusTODO = Stat;
        this.setDTStamp(new Date());
    }

    public setPriority(Prio: number): void {
        if(Prio >= 10) {
            this.priority = 0;
        }
        if(Prio <= -1) {
            this.priority = 0;
        }
        this.priority = Prio;
        this.setDTStamp(new Date());
    }
    
    public setRRule(Recur: string | undefined): void {
        this.rRule = Recur;
        this.setDTStamp(new Date());
    }

    public setAttendees(List: string[] | undefined): void {
        this.attendees = List;
        this.setDTStamp(new Date());
    }
    
    // Additional functionality. Should probably never be used
    public setCreator(Founder: string): void {
        this.creator = Founder;
        this.setDTStamp(new Date());
    }
}