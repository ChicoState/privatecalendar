/*class for events to work across the entire app hopefully. Ideally stores all necessary information from .ics format
and allows it to be used elsewhere.
*/

export default class Event {
    // Variables directly follow .ics format

    private uid!: string; //unique identifier for event
    private DTStamp!: Date; //when the event was last modified
    private DTstart!: Date;//when the event begins
    private DTend!: Date;//when the event ends
    private summary!: string; //title of the even, e.x. "Trevor's Bday"
    private description?: string; //event details, e.x. "Bring cake"
    private location?: string;//where the event occurs.
    private status?: "CONFIRMED" | "CANCELLED" | "TENTATIVE"; //status can only be one of three things.
    private rRule?: string; //used to set event frequency e.x. "FREQ=WEEKLY;BYDAY=MO".
    private attendees?: string[]; //list of attendees.
    private creator!: string; //name of event creator.


    constructor(
        id: string,  
        Start: Date, 
        End: Date, 
        Sum: string,    
        founder: string,
        desc?: string,
        loc?: string,
        stat?:"CONFIRMED" | "CANCELLED" | "TENTATIVE",
        recur?: string,
        participantList?: string[],
        )
    {
        //required values
        //Creates a random UID for the event, current date + random number
        this.uid = `${Date.now()} - ${Math.floor(Math.random())*100000}`;
        this.DTStamp = new Date(); //set current timestamp on creation
        this.DTstart = Start;
        this.DTend = End;
        this.summary = Sum;
        this.creator = founder;

        // optional values

        this.description = desc;
        this.location = loc;
        this.status = stat;
        this.rRule = recur;
        this.attendees = participantList;
    }



    

}