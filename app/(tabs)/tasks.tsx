import React, { useState } from "react";
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
} from "react-native";
import { MaterialCommunityIcons } from '@expo/vector-icons'; 

// Define an interface to manage the full set of Event properties in state
interface TaskEventData {
    id: string;
    summary: string;
    DTstart: string;
    DTend: string;
    creator: string;
    description: string;
    location: string;
    status: "CONFIRMED" | "CANCELLED" | "TENTATIVE";
    rRule: string;
    attendees: string;
}

// Default values for a new task/event
const DEFAULT_TASK_DATA: TaskEventData = {
    id: "", 
    summary: "",
    DTstart: "20251108T100000",
    DTend: "20251108T110000",
    creator: "Task App User",
    description: "",
    location: "",
    status: "TENTATIVE",
    rRule: "",
    attendees: "", 
};

// Task Page
const App: React.FC = () => {
    const [tasks, setTasks] = useState<Event[]>([]); 
    const [taskData, setTaskData] = useState<TaskEventData>(DEFAULT_TASK_DATA); 
    const [editIndex, setEditIndex] = useState<number>(-1);
    const [modalVisible, setModalVisible] = useState<boolean>(false);
    const [advancedOptionsVisible, setAdvancedOptionsVisible] = useState<boolean>(false); 

    // Helper to update a specific field in the current taskData state
    const handleChange = (field: keyof TaskEventData, value: string) => {
        setTaskData(prev => ({ ...prev, [field]: value }));
    };

    // Add Task 
    const handleAddTask = () => {
        setTaskData(DEFAULT_TASK_DATA); 
        setEditIndex(-1);
        setAdvancedOptionsVisible(false); // Reset dropdown when opening for new task
        setModalVisible(true);
    };

    // Edit Task 
    const handleEditTask = (index: number) => {
        const taskToEdit = tasks[index]; 
        
        setTaskData({
            id: taskToEdit.getUid(),
            summary: taskToEdit.getSummary(),
            DTstart: taskToEdit.getDTstart(),
            DTend: taskToEdit.getDTend(),
            creator: taskToEdit.getCreator(),
            description: taskToEdit.getDescription() || "",
            location: taskToEdit.getLocation() || "",
            status: taskToEdit.getStatus() || "TENTATIVE",
            rRule: taskToEdit.getRRule() || "",
            attendees: taskToEdit.getAttendees() ? taskToEdit.getAttendees()!.join(", ") : "",
        });

        setEditIndex(index);
        setAdvancedOptionsVisible(false); // Reset dropdown when opening for editing
        setModalVisible(true);
    };

    // Save Task
    const handleSaveTask = () => {
        const value = taskData.summary.trim();
        if (!value) return;

        const participantList = taskData.attendees
            .split(",")
            .map(s => s.trim())
            .filter(s => s.length > 0);

        if (editIndex !== -1) {
            const existingTask = tasks[editIndex];
            
            existingTask.setSummary(taskData.summary);
            existingTask.setDescription(taskData.description || undefined);
            existingTask.setLocation(taskData.location || undefined);
            existingTask.setDTstart(taskData.DTstart);
            existingTask.setDTend(taskData.DTend);
            existingTask.setCreator(taskData.creator);
            existingTask.setStatus(taskData.status);
            existingTask.setRRule(taskData.rRule || undefined);
            existingTask.setAttendees(participantList.length > 0 ? participantList : undefined);

            setTasks([...tasks]); 

        } else {
            const newEvent = new Event(
                taskData.id,
                taskData.DTstart,
                taskData.DTend,
                taskData.summary,
                taskData.creator,
                taskData.description || undefined,
                taskData.location || undefined,
                taskData.status,
                taskData.rRule || undefined,
                participantList.length > 0 ? participantList : undefined
            );

            setTasks((prev) => [...prev, newEvent]);
        }

        setTaskData(DEFAULT_TASK_DATA);
        setEditIndex(-1);
        setModalVisible(false);
    };

    // Cancels Task
    const handleCancel = () => {
        setTaskData(DEFAULT_TASK_DATA);
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

    type ItemProps = { item: Event; index: number }; 

    const renderItem = ({ item, index }: ItemProps) => {
        const summary = item.getSummary();
        const creator = item.getCreator();

        return (
            <View style={styles.task}>
                <View style={{ flexShrink: 1 }}>
                    <Text style={styles.itemList}>{summary || "No Title"} </Text>
                    {creator && (
                        <Text style={{ ...styles.itemList, fontSize: 14, color: '#aaa' }}>
                            Created by: {creator}
                        </Text>
                    )}
                </View>
                <View style={styles.taskButtons}>
                    <TouchableOpacity onPress={() => handleEditTask(index)}>
                        <Text style={styles.editButton}>Edit</Text>
                    </TouchableOpacity>
                    <TouchableOpacity onPress={() => handleDeleteTask(index)}>
                        <Text style={styles.deleteButton}>Delete</Text>
                    </TouchableOpacity>
                </View>
            </View>
        );
    };

    return ( <View style={styles.container}>
        <Text style={styles.title}>Task List</Text>

        {/* Add Task Button */}
        <TouchableOpacity style={styles.addButton} onPress={handleAddTask}>
            <Text style={styles.addButtonText}>Add Task</Text>
        </TouchableOpacity>

        {/* Task List */}
        <FlatList
            data={tasks}
            renderItem={renderItem}
            keyExtractor={(_, index) => index.toString()}
            keyboardShouldPersistTaps="handled"
        />

        {/* Add/Edit Modal */}
        <Modal
        animationType="slide"
        transparent
        visible={modalVisible}
        onRequestClose={handleCancel}
        >
        {/*
            ISSUE FIX: The issue with clicking on the box while scrolling is likely the TouchableWithoutFeedback.
            When you scroll, you are touching the area covered by the modal backdrop, which the TWB interprets as 
            a tap if the touch event isn't fully consumed by the ScrollView.
            
            We wrap the modal content with TWB to dismiss the keyboard, not the modal.
            The ScrollView itself is what allows scrolling of the content.
        */}
        <TouchableWithoutFeedback onPress={Keyboard.dismiss} accessible={false}>
            <View style={styles.modalBackdrop}>
                {/* The ScrollView ensures proper scrolling of the form content */}
                <ScrollView 
                    contentContainerStyle={styles.modalScroll}
                    keyboardShouldPersistTaps="handled" // Important for TWB + inputs
                >
                    <View style={styles.modalCard}>
                        <Text style={styles.modalTitle}>
                            {editIndex !== -1 ? "Edit Event/Task" : "Add Event/Task"}
                        </Text>
                        
                        {/* --- BASIC OPTIONS --- */}
                        <Text style={styles.inputLabel}>Summary (Required)</Text>
                        <TextInput
                            style={styles.input}
                            placeholder="e.g., Finish report by EOD"
                            placeholderTextColor="#aaa"
                            value={taskData.summary}
                            onChangeText={(text) => handleChange("summary", text)}
                            autoFocus
                        />

                        <Text style={styles.inputLabel}>Description</Text>
                        <TextInput
                            style={[styles.input, { height: 80 }]}
                            placeholder="e.g., Need to include Q3 data."
                            placeholderTextColor="#aaa"
                            value={taskData.description}
                            onChangeText={(text) => handleChange("description", text)}
                            multiline
                            numberOfLines={3} // Added for better UX on multiline
                        />
                        
                        <Text style={styles.inputLabel}>Location</Text>
                        <TextInput
                            style={styles.input}
                            placeholder="e.g., Home Office"
                            placeholderTextColor="#aaa"
                            value={taskData.location}
                            onChangeText={(text) => handleChange("location", text)}
                        />
                        
                        <Text style={styles.inputLabel}>Start Time (YYYYMMDDTHHMMSS)</Text>
                        <TextInput
                            style={styles.input}
                            placeholder="e.g., 20251108T100000"
                            placeholderTextColor="#aaa"
                            value={taskData.DTstart}
                            onChangeText={(text) => handleChange("DTstart", text)}
                        />
                        
                        <Text style={styles.inputLabel}>End Time (YYYYMMDDTHHMMSS)</Text>
                        <TextInput
                            style={styles.input}
                            placeholder="e.g., 20251108T110000"
                            placeholderTextColor="#aaa"
                            value={taskData.DTend}
                            onChangeText={(text) => handleChange("DTend", text)}
                        />

                        {/* --- ADVANCED OPTIONS DROPDOWN --- */}
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
                                <Text style={styles.inputLabel}>Creator</Text>
                                <TextInput
                                    style={styles.input}
                                    placeholder="Your Name"
                                    placeholderTextColor="#aaa"
                                    value={taskData.creator}
                                    onChangeText={(text) => handleChange("creator", text)}
                                />
                                
                                <Text style={styles.inputLabel}>Attendees (Comma-separated)</Text>
                                <TextInput
                                    style={styles.input}
                                    placeholder="e.g., Alice, Bob, Charlie"
                                    placeholderTextColor="#aaa"
                                    value={taskData.attendees}
                                    onChangeText={(text) => handleChange("attendees", text)}
                                />

                                <Text style={styles.inputLabel}>Status (CONFIRMED/CANCELLED/TENTATIVE)</Text>
                                <TextInput
                                    style={styles.input}
                                    placeholder="TENTATIVE (Options: CONFIRMED, CANCELLED, TENTATIVE)"
                                    placeholderTextColor="#aaa"
                                    value={taskData.status}
                                    onChangeText={(text) => handleChange("status", text as "CONFIRMED" | "CANCELLED" | "TENTATIVE")}
                                />

                                <Text style={styles.inputLabel}>Recurrence Rule (RRule)</Text>
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
            </TouchableWithoutFeedback>
        </Modal>
    </View>);
};

// CSS
const styles = StyleSheet.create({
    container: {flex: 1, padding: 40, marginTop: 40},
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
    taskButtons: {flexDirection: "row"},
    editButton: {marginRight: 10, color: "green", fontWeight: "bold", fontSize: 18},
    deleteButton: {color: "red", fontWeight: "bold", fontSize: 18},
    task: {
        flexDirection: "row",
        justifyContent: "space-between",
        alignItems: "center",
        marginBottom: 15,
        padding: 10,
        backgroundColor: "#333", 
        borderRadius: 8,
    },
    itemList: {fontSize: 19, color: "white"},
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
    modalButtons: {flexDirection: "row", justifyContent: "flex-end", alignItems: "center", marginTop: 10},
    btn: {paddingVertical: 10, paddingHorizontal: 16, borderRadius: 8},
    btnCancel: {backgroundColor: "#555"}, 
    btnSave: {backgroundColor: "blue"},
    btnText: {color: "white", fontWeight: "600"}
});

export default App;
