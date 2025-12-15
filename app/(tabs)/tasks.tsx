import React, { useState, useEffect, useRef } from "react";
import Event from "../utils/eventFramework";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  FlatList,
  StyleSheet,
  Modal,
  TouchableWithoutFeedback,
  Keyboard,
  ScrollView,
  Alert,
} from "react-native";
import { MaterialCommunityIcons } from '@expo/vector-icons';

// Define an interface to manage the full set of Event properties in state
interface TaskEventData {
    type: "VEVENT" | "VTODO"
    id: string;
    summary: string;
    DTstart: string; // Now always YYYYMMDDT000000
    DTend: string;   // Now always YYYYMMDDT000000
    creator: string;
    description: string;
    location: string;
    status: "CONFIRMED" | "CANCELLED" | "TENTATIVE";
    statusToDo: "NEEDS-ACTION" | "COMPLETED" | "IN-PROCESS" | "CANCELLED";
    priority: number
    rRule: string;
    attendees: string;
}

interface DateInputState {
    startYear: string; startMonth: string; startDay: string;
    endYear: string; endMonth: string; endDay: string;
}

// Helper to get current date/time in YYYYMMDDTHHMMSS format (with fixed time)
const getNowDateTimeString = () => {
    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const day = String(now.getDate()).padStart(2, '0');
    // Default time is always midnight T000000
    return `${year}${month}${day}T000000`;
}

// Default values for a new task/event
const DEFAULT_TASK_DATA: TaskEventData = {
    type: "VTODO",
    id: "", 
    summary: "",
    DTstart: "", 
    DTend: "",   
    creator: "Task App User",
    description: "",
    location: "",
    status: "TENTATIVE",
    statusToDo: "NEEDS-ACTION",
    priority: 0,
    rRule: "",
    attendees: "", 
};

// Define the available status options
const STATUS_OPTIONS: TaskEventData['statusToDo'][] = ["NEEDS-ACTION", "COMPLETED", "IN-PROCESS", "CANCELLED"];

const PRIORITY_OPTIONS = [
    { label: "No Preference", value: 0},
    { label: 'High', value: 1 },
    { label: 'Medium', value: 5 },
    { label: 'Low', value: 9 },
];

// --- Date/Time Helpers ---
// Helper to format date string from YYYYMMDDTHHMMSS to YYYY-MM-DD for display
const formatDateForDisplay = (dt: string) => {
    if (!dt || dt.length < 8) return "No Date Set";
    try {
        const year = dt.substring(0, 4);
        const month = dt.substring(4, 6);
        const day = dt.substring(6, 8);
        return `${year}-${month}-${day}`;
    } catch {
        return "Invalid Date";
    }
};

// Helper to safely extract date parts for input fields
const parseDateParts = (dt: string) => {
    if (!dt || dt.length < 8) return { year: "", month: "", day: "" };
    return {
        year: dt.substring(0, 4),
        month: dt.substring(4, 6),
        day: dt.substring(6, 8),
    };
};

// Helper to initialize tempDateInput
const initializeDateInputs = (data: TaskEventData): DateInputState => {
    const startParts = parseDateParts(data.DTstart);
    const endParts = parseDateParts(data.DTend);
    return {
        startYear: startParts.year,
        startMonth: startParts.month,
        startDay: startParts.day,
        endYear: endParts.year,
        endMonth: endParts.month,
        endDay: endParts.day,
    };
};

// --- Date Input Modal Component ---
interface DateInputModalProps {
    visible: boolean;
    tempDateInput: DateInputState;
    taskData: TaskEventData;
    setTempDateInput: React.Dispatch<React.SetStateAction<DateInputState>>;
    setDateInputModalVisible: React.Dispatch<React.SetStateAction<boolean>>;
    setTaskData: React.Dispatch<React.SetStateAction<TaskEventData>>;
    initializeDateInputs: (data: TaskEventData) => DateInputState;
}

// Get current date parts outside the component for stable defaults
const nowDT = getNowDateTimeString();
const defaultYear = nowDT.substring(0, 4);
const defaultMonth = nowDT.substring(4, 6);
const defaultDay = nowDT.substring(6, 8);

// --- Picker Option Generation ---
interface PickerOption {
    label: string;
    value: string;
}

const generateYears = (): PickerOption[] => {
    const currentYear = new Date().getFullYear();
    const years: PickerOption[] = [{ label: "YYYY", value: "" }]; // Placeholder for empty selection
    for (let i = currentYear - 5; i <= currentYear + 10; i++) {
        years.push({ label: String(i), value: String(i) });
    }
    return years;
}

const generateMonths = (): PickerOption[] => {
    const months: PickerOption[] = [{ label: "MM", value: "" }]; // Placeholder
    for (let i = 1; i <= 12; i++) {
        const monthStr = String(i).padStart(2, '0');
        months.push({ label: monthStr, value: monthStr });
    }
    return months;
}

// Helper for leap year logic
const isLeapYear = (year: number) => {
    return (year % 4 === 0 && year % 100 !== 0) || (year % 400 === 0);
};

// Function to generate days dynamically based on month and year
const getDaysInMonth = (yearStr: string, monthStr: string): number => {
    const year = parseInt(yearStr, 10);
    const month = parseInt(monthStr, 10);

    // If year or month is not yet fully selected, return 31 as the maximum safe number
    if (!yearStr || !monthStr || yearStr.length !== 4 || monthStr.length !== 2) {
        return 31; 
    }

    switch (month) {
        case 4: // April
        case 6: // June
        case 9: // September
        case 11: // November
            return 30;
        case 2: // February
            return isLeapYear(year) ? 29 : 28;
        default: // All others (Jan, Mar, May, Jul, Aug, Oct, Dec)
            return 31;
    }
};

const generateDays = (yearStr: string, monthStr: string): PickerOption[] => {
    const days: PickerOption[] = [{ label: "DD", value: "" }]; // Placeholder
    const maxDays = getDaysInMonth(yearStr, monthStr);
    
    for (let i = 1; i <= maxDays; i++) {
        const dayStr = String(i).padStart(2, '0');
        days.push({ label: dayStr, value: dayStr });
    }
    return days;
}

const YEAR_OPTIONS = generateYears();
const MONTH_OPTIONS = generateMonths();
// DAY_OPTIONS is generated dynamically
// --- End Picker Option Generation ---

// --- New Date Part Picker Modal ---
interface DatePartPickerModalProps {
    visible: boolean;
    options: PickerOption[];
    onSelect: (value: string) => void;
    onClose: () => void;
    title: string;
}

const DatePartPickerModal: React.FC<DatePartPickerModalProps> = ({ 
    visible, 
    options, 
    onSelect, 
    onClose, 
    title 
}) => {
    return (
        <Modal
            animationType="fade"
            transparent
            visible={visible}
            onRequestClose={onClose}
        >
            <TouchableWithoutFeedback onPress={onClose}>
                <View style={styles.dropdownOverlay}>
                    <TouchableWithoutFeedback onPress={() => {}}>
                        <View style={styles.dropdownContainer}>
                            <Text style={styles.pickerModalTitle}>{title}</Text>
                            <FlatList
                                data={options}
                                keyExtractor={(item) => item.value || item.label}
                                renderItem={({ item }) => (
                                    <TouchableOpacity
                                        style={styles.dropdownItem}
                                        onPress={() => {
                                            onSelect(item.value);
                                            onClose();
                                        }}
                                    >
                                        <Text style={styles.dropdownItemText}>{item.label}</Text>
                                    </TouchableOpacity>
                                )}
                                // Ensure scrolling works
                                keyboardShouldPersistTaps="always" 
                            />
                        </View>
                    </TouchableWithoutFeedback>
                </View>
            </TouchableWithoutFeedback>
        </Modal>
    );
};
// --- End Date Part Picker Modal ---

interface DateInputRowProps {
    type: "start" | "end";
    tempDateInput: DateInputState;
    handleSelectDatePart: (field: keyof DateInputState, value: string) => void;
}

// Define DateInputRow outside and memoize it
const DateInputRow: React.FC<DateInputRowProps> = React.memo(({ 
    type, 
    tempDateInput, 
    handleSelectDatePart 
}) => {
    const prefix = type === 'start' ? 'start' : 'end';
    const title = type === 'start' ? 'Start Date' : 'Due Date';
    
    const yearField: keyof DateInputState = `${prefix}Year`;
    const monthField: keyof DateInputState = `${prefix}Month`;
    const dayField: keyof DateInputState = `${prefix}Day`;

    const yearValue = tempDateInput[yearField];
    const monthValue = tempDateInput[monthField];
    const dayValue = tempDateInput[dayField];
    
    // State for managing which picker is currently open
    const [pickerVisible, setPickerVisible] = useState<keyof DateInputState | null>(null);

    const getDisplayValue = (value: string, placeholder: string) => value || placeholder;
    const getTextStyle = (value: string) => value ? styles.pickerSelectedText : styles.pickerPlaceholderText;

    // Dynamically generate day options based on current year/month selections
    const dynamicDayOptions = generateDays(yearValue, monthValue);


    return (
        <View style={{marginTop: 15}}>
            <Text style={styles.inputLabel}>{title} (YYYY/MM/DD)</Text>
            <View style={styles.dateInputContainer}>
                
                {/* Year Picker Button */}
                <TouchableOpacity
                    style={[styles.input, styles.dateInputPart, styles.pickerInput]}
                    onPress={() => setPickerVisible(yearField)}
                >
                    <Text style={getTextStyle(yearValue)}>
                        {getDisplayValue(yearValue, defaultYear)}
                    </Text>
                </TouchableOpacity>
                <Text style={styles.dateSeparator}>/</Text>
                
                {/* Month Picker Button */}
                <TouchableOpacity
                    style={[styles.input, styles.dateInputPart, styles.pickerInput]}
                    onPress={() => setPickerVisible(monthField)}
                >
                    <Text style={getTextStyle(monthValue)}>
                        {getDisplayValue(monthValue, defaultMonth)}
                    </Text>
                </TouchableOpacity>
                <Text style={styles.dateSeparator}>/</Text>
                
                {/* Day Picker Button */}
                <TouchableOpacity
                    style={[styles.input, styles.dateInputPart, styles.pickerInput]}
                    onPress={() => setPickerVisible(dayField)}
                >
                    <Text style={getTextStyle(dayValue)}>
                        {getDisplayValue(dayValue, defaultDay)}
                    </Text>
                </TouchableOpacity>

                {/* Year Picker Modal */}
                <DatePartPickerModal
                    visible={pickerVisible === yearField}
                    options={YEAR_OPTIONS}
                    onSelect={(value) => handleSelectDatePart(yearField, value)}
                    onClose={() => setPickerVisible(null)}
                    title="Select Year"
                />
                
                {/* Month Picker Modal */}
                <DatePartPickerModal
                    visible={pickerVisible === monthField}
                    options={MONTH_OPTIONS}
                    onSelect={(value) => handleSelectDatePart(monthField, value)}
                    onClose={() => setPickerVisible(null)}
                    title="Select Month"
                />

                {/* Day Picker Modal */}
                <DatePartPickerModal
                    visible={pickerVisible === dayField}
                    options={dynamicDayOptions} // Use dynamically generated options
                    onSelect={(value) => handleSelectDatePart(dayField, value)}
                    onClose={() => setPickerVisible(null)}
                    title="Select Day"
                />

            </View>
        </View>
    );
});


const DateInputModal: React.FC<DateInputModalProps> = ({
    visible,
    tempDateInput,
    taskData,
    setTempDateInput,
    setDateInputModalVisible,
    setTaskData,
    initializeDateInputs
}) => {
    
    // Handler for selecting a date part
    const handleSelectDatePart = (field: keyof DateInputState, value: string) => {
        setTempDateInput(prev => {
            const newState = {
                ...prev,
                [field]: value,
            };

            const prefix = field.startsWith('start') ? 'start' : 'end';
            const yearField: keyof DateInputState = `${prefix}Year`;
            const monthField: keyof DateInputState = `${prefix}Month`;
            const dayField: keyof DateInputState = `${prefix}Day`;

            // If month or year changed, correct the day if necessary
            if (field === yearField || field === monthField) {
                const year = newState[yearField];
                const month = newState[monthField];
                const currentDay = newState[dayField];

                if (year && month && currentDay) {
                    const maxDays = getDaysInMonth(year, month);
                    const currentDayInt = parseInt(currentDay, 10);

                    // Check if the current selected day is now invalid for the new month/year
                    if (!isNaN(currentDayInt) && currentDayInt > maxDays) {
                        // Correct the day to the maximum valid day
                        newState[dayField] = String(maxDays).padStart(2, '0');
                    }
                }
            }
            return newState;
        });
    };
    
    // Function to construct YYYYMMDD string and validate
    const constructDate = (year: string, month: string, day: string, name: string) => {
        const yearValue = year.trim();
        const monthValue = month.trim();
        const dayValue = day.trim();
        
        // Check if all fields are empty 
        if (yearValue.length === 0 && monthValue.length === 0 && dayValue.length === 0) {
            return ""; 
        }

        // Basic validation: all parts must be set to the correct length
        if (yearValue.length !== 4 || monthValue.length !== 2 || dayValue.length !== 2) {
             // If validation fails here, it means the user selected the placeholder option in one field
            Alert.alert("Input Error", `${name} date must have the year, month, and day fully selected or all left blank.`);
            return null;
        }

        // Simple integer parsing/range check
        const m = parseInt(monthValue, 10);
        const d = parseInt(dayValue, 10);

        if (m < 1 || m > 12 || d < 1 || d > 31) {
            // This case should be rare with the scroll menu
            Alert.alert("Input Error", `${name} date has an invalid month (1-12) or day (1-31).`);
            return null;
        }

        return `${yearValue}${monthValue}${dayValue}`;
    };

    const handleDone = () => {
        const { startYear, startMonth, startDay, endYear, endMonth, endDay } = tempDateInput;

        const startDTdatePart = constructDate(startYear, startMonth, startDay, "Start");
        const endDTdatePart = constructDate(endYear, endMonth, endDay, "Due");

        if (startDTdatePart === null || endDTdatePart === null) return; // Validation failed
        
        // Append fixed time T000000 (midnight)
        let finalDTstart = startDTdatePart ? `${startDTdatePart}T000000` : "";
        let finalDTend = endDTdatePart ? `${endDTdatePart}T000000` : "";

        // Auto-set DTend = DTstart if DTstart is set and DTend is empty
        if (finalDTstart && !finalDTend) {
            finalDTend = finalDTstart;
        }
        
        // Final time sequence validation (DTstart before DTend)
        if (finalDTstart.length >= 15 && finalDTend.length >= 15 && finalDTstart > finalDTend) {
             Alert.alert("Date Error", "Due date cannot be before start date.");
             return;
        }

        // Update the parent state
        setTaskData(prev => ({
            ...prev,
            DTstart: finalDTstart,
            DTend: finalDTend,
        }));

        setDateInputModalVisible(false);
    };

    // Clears both DTstart and DTend
    const handleRemoveDates = () => {
        // 1. Update the parent state with empty dates
        setTaskData(prev => ({
            ...prev,
            DTstart: "",
            DTend: "",
        }));

        // 2. Clear the local date input state to match
        setTempDateInput(initializeDateInputs(DEFAULT_TASK_DATA));

        // 3. Close the modal
        setDateInputModalVisible(false);
    };

    const handleCancelDateInput = () => {
        // Restore tempDateInput to match the current taskData state when cancelling
        setTempDateInput(initializeDateInputs(taskData));
        setDateInputModalVisible(false);
    }
    
    return (
        <Modal
            animationType="slide"
            transparent
            visible={visible}
            onRequestClose={handleCancelDateInput}
        >
            {/* TouchableWithoutFeedback removed here to fix numpad issue */}
            <View style={styles.modalBackdrop}>
                <ScrollView contentContainerStyle={styles.modalScroll} keyboardShouldPersistTaps="always">
                    <View style={styles.modalCard}>
                        <Text style={styles.modalTitle}>Set Start & Due Dates</Text>

                        <DateInputRow 
                            type="start" 
                            tempDateInput={tempDateInput} 
                            handleSelectDatePart={handleSelectDatePart} // Pass new handler
                        />
                        <DateInputRow 
                            type="end" 
                            tempDateInput={tempDateInput} 
                            handleSelectDatePart={handleSelectDatePart} // Pass new handler
                        />
                        
                        <View style={styles.modalButtons}>
                            {/* Remove Dates Button (only shown if a date is set) */}
                            {(taskData.DTstart || taskData.DTend) ? (
                                <TouchableOpacity 
                                    style={[styles.btn, styles.btnRemove]} 
                                    onPress={handleRemoveDates}
                                >
                                    <Text style={styles.btnText}>Remove Dates</Text>
                                </TouchableOpacity>
                            ) : null}

                            <View style={{flex: 1}} />
                            
                            <TouchableOpacity 
                                style={[styles.btn, styles.btnCancel]} 
                                onPress={handleCancelDateInput}
                            >
                                <Text style={styles.btnText}>Cancel</Text>
                            </TouchableOpacity>
                            <View style={{ width: 12 }} />
                            <TouchableOpacity 
                                style={[styles.btn, styles.btnSave]} 
                                onPress={handleDone}
                            >
                                <Text style={styles.btnText}>Done</Text>
                            </TouchableOpacity>
                        </View>
                    </View>
                </ScrollView>
            </View>
        </Modal>
    );
};
// --- End Date Input Modal Component ---

// Task Page
const App: React.FC = () => {
    // ... (All other state and logic remains the same)
    const [tasks, setTasks] = useState<Event[]>([]); 
    const [taskData, setTaskData] = useState<TaskEventData>(DEFAULT_TASK_DATA); 
    const [editIndex, setEditIndex] = useState<number>(-1);
    const [modalVisible, setModalVisible] = useState<boolean>(false);
    const [dateInputModalVisible, setDateInputModalVisible] = useState<boolean>(false); 
    const [advancedOptionsVisible, setAdvancedOptionsVisible] = useState<boolean>(false); 
    const [statusDropdownVisible, setStatusDropdownVisible] = useState<boolean>(false);
    const [priorityDropdownVisible, setPriorityDropdownVisible] = useState<boolean>(false);

    // NEW STATE: For managing collapsible sections
    const [sectionsOpen, setSectionsOpen] = useState<{ [key: string]: boolean }>({
        'Due Tasks': true,
        'No Due Date': true,
        'Completed': false, // Closed by default
    });

    // STATE: Holds the raw, partial text input for date fields in the modal
    const [tempDateInput, setTempDateInput] = useState<DateInputState>(initializeDateInputs(DEFAULT_TASK_DATA));
    
    // Helper to update a specific field in the current taskData state
    const handleChange = (field: keyof TaskEventData, value: string | number) => {
        if (field === "status") {
            setTaskData(prev => ({ ...prev, [field]: value as TaskEventData['status'] }));
        } else {
            setTaskData(prev => ({ ...prev, [field]: value }));
        }
    };
    
    // Add Task 
    const handleAddTask = () => {
        setTaskData(DEFAULT_TASK_DATA); 
        setTempDateInput(initializeDateInputs(DEFAULT_TASK_DATA)); // Initialize date inputs
        setEditIndex(-1);
        setAdvancedOptionsVisible(false);
        setStatusDropdownVisible(false); 
        setPriorityDropdownVisible(false);
        setModalVisible(true);
    };

    // Edit Task 
    const handleEditTask = (index: number) => {
        const taskToEdit = tasks[index]; 

        const newtaskData: TaskEventData = {
            type: (taskToEdit.getType() || "VTODO") as TaskEventData['type'],
            id: taskToEdit.getUid(),
            summary: taskToEdit.getSummary(),
            DTstart: taskToEdit.getDTstart(),
            DTend: taskToEdit.getDTend(),
            creator: taskToEdit.getCreator(),
            description: taskToEdit.getDescription() || "",
            location: taskToEdit.getLocation() || "",
            status: (taskToEdit.getStatus() || "TENTATIVE") as TaskEventData['status'],
            statusToDo: (taskToEdit.getstatusToDo() || "NEEDS-ACTION") as TaskEventData['statusToDo'],
            priority: (taskToEdit.getPriority()),
            rRule: taskToEdit.getRRule() || "",
            attendees: taskToEdit.getAttendees() ? taskToEdit.getAttendees()!.join(", ") : "",
        };

        setTaskData(newtaskData);
        setTempDateInput(initializeDateInputs(newtaskData)); // Initialize date inputs from existing data
        setEditIndex(index);
        setAdvancedOptionsVisible(false);
        setStatusDropdownVisible(false); 
        setPriorityDropdownVisible(false);
        setModalVisible(true);
    };
    
    // Function to select an option from the custom status dropdown (No change)
    const handleSelectStatus = (status: TaskEventData['statusToDo']) => {
        handleChange('statusToDo', status);
        setStatusDropdownVisible(false);
    };

    // Function to select an option from the custom priority dropdown (No change)
    const handleSelectPriority = (priority: number) => {
        handleChange('priority', priority);
        setPriorityDropdownVisible(false);
    };

    // Save Task
    const handleSaveTask = () => {
        const value = taskData.summary.trim();
        if (!value) return;
        
        // Final time sequence validation (DTstart before DTend)
        const startDT = taskData.DTstart;
        const endDT = taskData.DTend;

        if (startDT.length >= 8 && endDT.length >= 8) {
             // Extract YYYYMMDD part
             const startPart = startDT.substring(0, 8);
             const endPart = endDT.substring(0, 8);
             
             // Simple string comparison works here for YYYYMMDD
             if (startPart > endPart) {
                 Alert.alert("Date Error", "Due date cannot be before start date.");
                 return;
             }
        }

        const participantList = taskData.attendees
            .split(",")
            .map(s => s.trim())
            .filter(s => s.length > 0);

        // 5. Perform Save
        if (editIndex !== -1) {
            const existingTask = tasks[editIndex];
            
            existingTask.setSummary(taskData.summary);
            existingTask.setDescription(taskData.description || undefined);
            existingTask.setLocation(taskData.location || undefined);
            existingTask.setDTstart(taskData.DTstart); 
            existingTask.setDTend(taskData.DTend);
            existingTask.setCreator(taskData.creator);
            existingTask.setstatusToDo(taskData.statusToDo);
            existingTask.setPriority(taskData.priority);
            existingTask.setRRule(taskData.rRule || undefined);
            existingTask.setAttendees(participantList.length > 0 ? participantList : undefined);

            setTasks([...tasks]); 

        } else {
            const newEvent = new Event(
                taskData.type,
                taskData.id,
                taskData.DTstart, 
                taskData.DTend,   
                taskData.summary,
                taskData.creator,
                taskData.description || undefined,
                taskData.location || undefined,
                taskData.status,
                taskData.statusToDo,
                taskData.priority,
                taskData.rRule || undefined,
                participantList.length > 0 ? participantList : undefined
            );

            setTasks((prev) => [...prev, newEvent]);
        }

        // Reset state
        setTaskData(DEFAULT_TASK_DATA);
        setTempDateInput(initializeDateInputs(DEFAULT_TASK_DATA)); 
        setEditIndex(-1);
        setModalVisible(false);
    };

    // Cancels Task
    const handleCancel = () => {
        setTaskData(DEFAULT_TASK_DATA);
        setTempDateInput(initializeDateInputs(DEFAULT_TASK_DATA)); 
        setEditIndex(-1);
        setModalVisible(false);
    };
    
    // Deletes Task
    const handleDeleteTask = (index: number) => {
        const updated = [...tasks];
        updated.splice(index, 1);
        setTasks(updated);
        if (editIndex === index) setEditIndex(-1);
    };

    // Deletes Task Modal handeler
    const handleModalDelete = () => {
        if (editIndex !== -1) {
            handleDeleteTask(editIndex);
            setModalVisible(false);
        }
    };

    // NEW FUNCTION: Toggle task completion
    const handleToggleComplete = (taskToToggle: Event, index: number) => {
        const newStatus = taskToToggle.getstatusToDo() === 'COMPLETED' ? 'NEEDS-ACTION' : 'COMPLETED';
        taskToToggle.setstatusToDo(newStatus);
        
        // Force a state update to trigger re-sort/re-render
        setTasks([...tasks]); 
    };

    type ItemProps = { item: Event; index: number }; 

    // MODIFIED: Render item to include a checkbox
    const renderItem = ({ item, index }: ItemProps) => {
        const summary = item.getSummary();
        const location = item.getLocation();
        const dtend = item.getDTend();
        const isCompleted = item.getstatusToDo() === 'COMPLETED';

        const endDateDisplay = formatDateForDisplay(dtend);
        const taskIndex = tasks.findIndex(t => t.getUid() === item.getUid());

        return (
            <View style={[styles.task, isCompleted && styles.completedTask]}>
                
                {/* Completion Checkbox */}
                <TouchableOpacity 
                    onPress={() => handleToggleComplete(item, taskIndex)} 
                    style={styles.checkbox}
                >
                    <MaterialCommunityIcons 
                        name={isCompleted ? "checkbox-marked-circle" : "checkbox-blank-circle-outline"} 
                        size={24} 
                        color={isCompleted ? "#5cb85c" : "#ccc"} 
                    />
                </TouchableOpacity>

                <View style={{ flexShrink: 1, flex: 1 }}>
                    <Text style={[styles.itemList, isCompleted && styles.completedText]}>
                        {summary || "No Title"} 
                    </Text>
                    {location && (
                        <Text style={{ ...styles.itemList, fontSize: 14, color: isCompleted ? '#666' : '#aaa' }}>
                            Location: {location}
                        </Text>
                    )}
                    {(dtend && endDateDisplay !== "No Date Set") && (
                        <Text style={{ ...styles.itemList, fontSize: 14, color: isCompleted ? '#666' : '#aaa' }}>
                            Due: {endDateDisplay}
                        </Text>
                    )}
                </View>
                <View style={styles.taskButtons}>
                    <TouchableOpacity onPress={() => handleEditTask(taskIndex)} style={styles.iconButton}>
                        <MaterialCommunityIcons name="pencil" size={24} color="#5cb85c" /> 
                    </TouchableOpacity>
                </View>
            </View>
        );
    };

    // NEW FUNCTION: Group and sort tasks
    const getGroupedAndSortedTasks = () => {
        const dueTasks: Event[] = [];
        const noDueDateTasks: Event[] = [];
        const completedTasks: Event[] = [];

        tasks.forEach(task => {
            const status = task.getstatusToDo();
            const dtend = task.getDTend();

            if (status === 'COMPLETED') {
                completedTasks.push(task);
            } else if (dtend && dtend.length >= 8) {
                dueTasks.push(task);
            } else {
                noDueDateTasks.push(task);
            }
        });

        // Sort Due Tasks by DTend ascending (earliest due date first)
        dueTasks.sort((a, b) => {
            // Compare the YYYYMMDD part
            const aDate = a.getDTend().substring(0, 8);
            const bDate = b.getDTend().substring(0, 8);
            if (aDate < bDate) return -1;
            if (aDate > bDate) return 1;
            return 0;
        });

        // No Due Date and Completed tasks remain unsorted within their groups

        return { dueTasks, noDueDateTasks, completedTasks };
    };

    const groupedTasks = getGroupedAndSortedTasks();

    const renderSection = (title: string, data: Event[]) => {
        const isOpen = sectionsOpen[title];
        const count = data.length;

        const toggleSection = () => {
            setSectionsOpen(prev => ({ ...prev, [title]: !prev[title] }));
        };

        // If the array is empty, the section is completely hidden in the return block,
        // but this function is only called if data.length > 0 anyway.
        
        return (
            <View key={title} style={styles.sectionContainer}>
                <TouchableOpacity style={styles.sectionHeader} onPress={toggleSection}>
                    <Text style={styles.sectionTitle}>{title} ({count})</Text>
                    <MaterialCommunityIcons 
                        name={isOpen ? "chevron-up" : "chevron-down"} 
                        size={24} 
                        color="white" 
                    />
                </TouchableOpacity>
                {isOpen && (
                    <View style={styles.sectionContent}>
                        {/* We use .map here to render items within the section's View */}
                        {data.map((item, index) => (
                            <View key={item.getUid() || index.toString()}>
                                {renderItem({ item, index: tasks.findIndex(t => t.getUid() === item.getUid()) })}
                            </View>
                        ))}
                    </View>
                )}
            </View>
        );
    };

    const startDisplay = formatDateForDisplay(taskData.DTstart);
    const endDisplay = formatDateForDisplay(taskData.DTend);
    const dateButtonText = (startDisplay === "No Date Set" && endDisplay === "No Date Set")
        ? "Set Start/Due Dates"
        : `${startDisplay} to ${endDisplay}`;


    return ( <View style={styles.container}>
        <Text style={styles.title}>Task List</Text>

        {/* Add Task Button */}
        <TouchableOpacity style={styles.addButton} onPress={handleAddTask}>
            <Text style={styles.addButtonText}>Add Task</Text>
        </TouchableOpacity>

        {/* Task List - NOW USING SCROLLVIEW FOR SECTIONS */}
        <ScrollView style={styles.taskListScroll} keyboardShouldPersistTaps="handled">
            {/* Conditional rendering: Only render a section if the corresponding array has tasks */}
            {groupedTasks.dueTasks.length > 0 && renderSection('Due Tasks', groupedTasks.dueTasks)}
            {groupedTasks.noDueDateTasks.length > 0 && renderSection('No Due Date', groupedTasks.noDueDateTasks)}
            {groupedTasks.completedTasks.length > 0 && renderSection('Completed', groupedTasks.completedTasks)}
        </ScrollView>
        
        {/* Add/Edit Modal */}
        <Modal
        animationType="slide"
        transparent
        visible={modalVisible}
        onRequestClose={handleCancel}
        >
        <View style={styles.modalBackdrop}>
            <ScrollView 
                contentContainerStyle={styles.modalScroll}
                keyboardShouldPersistTaps="always"
            >
                <View style={styles.modalCard}>
                    <Text style={styles.modalTitle}>
                        {editIndex !== -1 ? "Edit Event/Task" : "Add Event/Task"}
                    </Text>
                    
                    {/* --- BASIC OPTIONS --- */}
                    <Text style={styles.inputLabel}>Title (Required)</Text>
                    <TextInput
                        style={styles.input}
                        placeholder="New Task"
                        placeholderTextColor="#aaa"
                        value={taskData.summary}
                        onChangeText={(text) => handleChange("summary", text)}
                        autoFocus
                    />
                    
                    {/* Date Input Button */}
                    <TouchableOpacity 
                        style={styles.dateTimeButton} 
                        onPress={() => setDateInputModalVisible(true)}
                    >
                        <MaterialCommunityIcons name="calendar" size={24} color="#fff" />
                        <Text style={styles.dateTimeButtonText}>
                            {dateButtonText}
                        </Text>
                    </TouchableOpacity>

                    <Text style={styles.inputLabel}>Location</Text>
                    <TextInput
                        style={styles.input}
                        placeholder=""
                        placeholderTextColor="#aaa"
                        value={taskData.location}
                        onChangeText={(text) => handleChange("location", text)}
                    />
                    
                    <Text style={styles.inputLabel}>Description</Text>
                    <TextInput
                        style={[styles.input, { height: 80 }]}
                        placeholder=""
                        placeholderTextColor="#aaa"
                        value={taskData.description}
                        onChangeText={(text) => handleChange("description", text)}
                        multiline
                        numberOfLines={3}
                    />

                    {/* --- ADVANCED OPTIONS DROPDOWN (No change) --- */}
                    <TouchableOpacity 
                        style={styles.advancedToggle} 
                        onPress={() => setAdvancedOptionsVisible(!advancedOptionsVisible)}
                    >
                        <Text style={styles.advancedToggleText}>
                            Advanced Options
                        </Text>
                        <MaterialCommunityIcons 
                            name={advancedOptionsVisible ? "chevron-up" : "chevron-down"} 
                            size={24} 
                            color="#66c" 
                        />
                    </TouchableOpacity>

                    {advancedOptionsVisible && (
                        <View>
                            <Text style={styles.inputLabel}>Attendees (Comma-separated)</Text>
                            <TextInput
                                style={styles.input}
                                placeholder=""
                                placeholderTextColor="#aaa"
                                value={taskData.attendees}
                                onChangeText={(text) => handleChange("attendees", text)}
                            />

                            <Text style={styles.inputLabel}>Status</Text>
                            <TouchableOpacity 
                                style={styles.customDropdownButton}
                                onPress={() => setStatusDropdownVisible(true)}
                            >
                                <Text style={styles.customDropdownText}>{taskData.statusToDo}</Text>
                                <MaterialCommunityIcons 
                                    name="chevron-down" 
                                    size={24} 
                                    color="#ccc" 
                                />
                            </TouchableOpacity>

                            <Text style={styles.inputLabel}>Priority</Text>
                            <TouchableOpacity 
                                style={styles.customDropdownButton}
                                onPress={() => setPriorityDropdownVisible(true)}
                            >
                                <Text style={styles.customDropdownText}>
                                    {PRIORITY_OPTIONS.find(p => p.value === taskData.priority)?.label || 'No Preference'}
                                </Text>
                                <MaterialCommunityIcons 
                                    name="chevron-down" 
                                    size={24} 
                                    color="#ccc" 
                                />
                            </TouchableOpacity>

                            <Text style={styles.inputLabel}>Recurrence Rule</Text>
                            <TextInput
                                style={styles.input}
                                placeholder="e.g., FREQ=WEEKLY;BYDAY=MO"
                                placeholderTextColor="#aaa"
                                value={taskData.rRule}
                                onChangeText={(text) => handleChange("rRule", text)}
                                returnKeyType="done"
                                onSubmitEditing={handleSaveTask}
                            />
                        </View>
                    )}
                    {/* --- END ADVANCED OPTIONS --- */}

                    <View style={styles.modalButtons}>
                        {editIndex !== -1 ? (
                            <TouchableOpacity
                                style={styles.deleteModalButton}
                                onPress={handleModalDelete}
                            >
                                <MaterialCommunityIcons name="trash-can" size={24} color="red"/>
                            </TouchableOpacity>
                        ): null}

                        <View style={{flex: 1}} />
                        <TouchableOpacity style={[styles.btn, styles.btnCancel]} onPress={handleCancel}>
                            <Text style={styles.btnText}>Cancel</Text>
                        </TouchableOpacity>

                        <View style={{ width: 12 }} />

                        <TouchableOpacity style={[styles.btn, styles.btnSave]} onPress={handleSaveTask}>
                            <Text style={styles.btnText}>Save</Text>
                        </TouchableOpacity>
                    </View>
                </View>
            </ScrollView>
        </View>
        </Modal>

        {/* Date Input Modal */}
        <DateInputModal 
            visible={dateInputModalVisible}
            tempDateInput={tempDateInput}
            taskData={taskData}
            setTempDateInput={setTempDateInput}
            setDateInputModalVisible={setDateInputModalVisible}
            setTaskData={setTaskData}
            initializeDateInputs={initializeDateInputs}
        />

        {/* Custom Status Dropdown Modal */}
        <Modal
            animationType="fade"
            transparent
            visible={statusDropdownVisible}
            onRequestClose={() => setStatusDropdownVisible(false)}
        >
            <TouchableWithoutFeedback onPress={() => setStatusDropdownVisible(false)}>
                <View style={styles.dropdownOverlay}>
                    <View style={styles.dropdownContainer}>
                        {STATUS_OPTIONS.map((statusToDo) => (
                            <TouchableOpacity
                                key={statusToDo}
                                style={styles.dropdownItem}
                                onPress={() => handleSelectStatus(statusToDo)}
                            >
                                <Text style={styles.dropdownItemText}>{statusToDo}</Text>
                            </TouchableOpacity>
                        ))}
                    </View>
                </View>
            </TouchableWithoutFeedback>
        </Modal>

        {/* Custom Priority Dropdown Modal */}
        <Modal
            animationType="fade"
            transparent
            visible={priorityDropdownVisible}
            onRequestClose={() => setPriorityDropdownVisible(false)}
        >
            <TouchableWithoutFeedback onPress={() => setPriorityDropdownVisible(false)}>
                <View style={styles.dropdownOverlay}>
                    <View style={styles.dropdownContainer}>
                        {PRIORITY_OPTIONS.map((priority) => (
                            <TouchableOpacity
                                key={priority.value}
                                style={styles.dropdownItem}
                                onPress={() => handleSelectPriority(priority.value)}
                            >
                                <Text style={styles.dropdownItemText}>
                                    {priority.label} ({priority.value})
                                </Text>
                            </TouchableOpacity>
                        ))}
                    </View>
                </View>
            </TouchableWithoutFeedback>
        </Modal>
    </View>);
};

// CSS 
const styles = StyleSheet.create({
    container: {flex: 1, padding: 40, marginTop: 40, backgroundColor: 'black'},
    title: { 
        fontSize: 24, 
        fontWeight: "bold", 
        marginBottom: 20, 
        color: "white", 
        textAlign: "center"},
    inputLabel: {
        color: "#ccc",
        fontSize: 14,
        marginTop: 10,
        marginBottom: 4,
    },
    input: {
        borderWidth: 1, 
        borderColor: "#444", 
        padding: 10,
        marginBottom: 8, 
        borderRadius: 8,
        fontSize: 16, 
        color: "white",
        backgroundColor: "#222" 
    },
    customDropdownButton: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        borderWidth: 1, 
        borderColor: "#444", 
        padding: 10,
        marginBottom: 8, 
        borderRadius: 8,
        backgroundColor: "#222",
    },
    customDropdownText: {
        fontSize: 16, 
        color: "white",
        fontWeight: 'bold',
    },
    dropdownOverlay: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        backgroundColor: 'rgba(0, 0, 0, 0.5)',
    },
    dropdownContainer: {
        width: '70%',
        maxHeight: '60%', // Constrain height for scrolling
        backgroundColor: '#181818',
        borderRadius: 10,
        padding: 5,
        borderWidth: 1,
        borderColor: '#444',
    },
    dropdownItem: {
        padding: 15,
        borderBottomWidth: 1,
        borderBottomColor: '#333',
    },
    dropdownItemText: {
        color: 'white',
        fontSize: 16,
        textAlign: 'center', // Center text in picker items
    },
    pickerModalTitle: {
        color: 'white',
        fontSize: 18,
        fontWeight: 'bold',
        padding: 15,
        borderBottomWidth: 2,
        borderBottomColor: '#666',
        textAlign: 'center'
    },
    addButton: {
        backgroundColor: "blue",
        padding: 10,
        borderRadius: 5,
        marginBottom: 10},
    addButtonText: {
        color: "white",
        fontWeight: "bold",
        textAlign: "center",
        fontSize: 18},
    taskButtons: {
        flexDirection: "row",
        alignItems: 'center',
    },
    iconButton: {
        padding: 5,
    },
    task: {
        flexDirection: "row",
        justifyContent: "space-between",
        alignItems: "center",
        marginBottom: 8, // Reduced margin
        padding: 10,
        backgroundColor: "#333", 
        borderRadius: 8,
    },
    completedTask: {
        backgroundColor: "#2a2a2a", // Darker background for completed tasks
        borderLeftWidth: 5,
        borderLeftColor: '#5cb85c', // Green stripe
    },
    itemList: {fontSize: 19, color: "white"},
    completedText: {
        textDecorationLine: 'line-through',
        color: '#888',
    },
    checkbox: {
        marginRight: 10,
    },
    modalBackdrop: {
        flex: 1,
        backgroundColor: "rgba(0,0,0,0.8)", 
        justifyContent: "center",
        padding: 16, 
    },
    modalScroll: {
        flexGrow: 1,
        justifyContent: 'center',
    },
    modalCard: {
        backgroundColor: "#181818",
        borderRadius: 16,
        padding: 20,
    },
    modalTitle: {color: "white", fontSize: 22, fontWeight: "bold", marginBottom: 16},
    advancedToggle: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginTop: 15,
        marginBottom: 5,
        paddingVertical: 8,
        paddingHorizontal: 5,
        borderTopWidth: 1,
        borderBottomWidth: 1,
        borderColor: '#444',
    },
    advancedToggleText: {
        color: "#66c",
        fontSize: 16,
        fontWeight: "bold",
    },
    modalButtons: {
        flexDirection: "row", 
        justifyContent: "space-between",
        alignItems: "center", 
        marginTop: 20,
    },
    deleteModalButton: {
        padding: 10,
    },
    btn: {paddingVertical: 10, paddingHorizontal: 16, borderRadius: 8},
    btnCancel: {backgroundColor: "#555"}, 
    btnSave: {backgroundColor: "blue"},
    btnRemove: {backgroundColor: "#c00"}, 
    btnText: {color: "white", fontWeight: "600"},
    dateTimeButton: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#4a4', 
        padding: 12,
        borderRadius: 8,
        marginTop: 10,
        marginBottom: 10,
    },
    dateTimeButtonText: {
        color: 'white',
        fontSize: 16,
        fontWeight: 'bold',
        marginLeft: 10,
    },
    // Styles for the DateInputModal
    dateInputContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        marginBottom: 5,
    },
    dateInputPart: {
        flex: 1,
        paddingHorizontal: 5,
        justifyContent: 'center',
        alignItems: 'center',
    },
    dateSeparator: {
        color: '#ccc',
        fontSize: 18,
        marginHorizontal: 5,
        fontWeight: 'bold',
    },
    pickerInput: {
        height: 40,
        padding: 0,
        // Inherits border/background from styles.input
    },
    pickerSelectedText: {
        color: 'white',
        fontSize: 16,
        fontWeight: 'bold',
    },
    pickerPlaceholderText: {
        color: '#888', // Match placeholder color
        fontSize: 16,
    },
    // New styles for task sections
    taskListScroll: {
        flex: 1,
        paddingBottom: 20, // Add some padding at the bottom of the scroll view
    },
    sectionContainer: {
        marginBottom: 15,
        backgroundColor: '#222',
        borderRadius: 8,
        overflow: 'hidden', // To contain child views
    },
    sectionHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        padding: 12,
        backgroundColor: '#333',
        borderBottomWidth: 1,
        borderBottomColor: '#444',
    },
    sectionTitle: {
        fontSize: 18,
        fontWeight: 'bold',
        color: 'white',
    },
    sectionContent: {
        padding: 8,
    },
    noTasksText: {
        color: '#aaa',
        padding: 10,
        textAlign: 'center',
    }
});

export default App;
