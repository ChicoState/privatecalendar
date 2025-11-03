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
} from "react-native";

// Task Page
const App: React.FC = () => {
    const [task, setTask] = useState<string>("");
    const [tasks, setTasks] = useState<string[]>([]);
    const [editIndex, setEditIndex] = useState<number>(-1);
    const [modalVisible, setModalVisible] = useState<boolean>(false);

    // Add Task
    const handleAddTask = () => {
        setTask("");
        setEditIndex(-1);
        setModalVisible(true);
    };

    // Edit Task
    const handleEditTask = (index: number) => {
        setTask(tasks[index]);
        setEditIndex(index);
        setModalVisible(true);
    };

    // Save Task
    const handleSaveTask = () => {
        const value = task.trim();
        if (!value) return;

        if (editIndex !== -1) {
            const updated = [...tasks];
            updated[editIndex] = value;
            setTasks(updated);
        } else {
            setTasks((prev) => [...prev, value]);
        }

        setTask("");
        setEditIndex(-1);
        setModalVisible(false);
    };

    // Cancels Task
    const handleCancel = () => {
        setTask("");
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

    type ItemProps = { item: string; index: number };

    const renderItem = ({ item, index }: ItemProps) => (
        <View style={styles.task}>
            <Text style={styles.itemList}>{item} </Text>
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
        <TouchableWithoutFeedback onPress={Keyboard.dismiss}>
            <View style={styles.modalBackdrop}>
                <View style={styles.modalCard}>
                <Text style={styles.modalTitle}>
                    {editIndex !== -1 ? "Edit Task" : "Add Task"}
                </Text>

                <TextInput
                    style={styles.input}
                    placeholder="What do you need to do?"
                    placeholderTextColor="#aaa"
                    value={task}
                    onChangeText={setTask}
                    autoFocus
                    returnKeyType="done"
                    onSubmitEditing={handleSaveTask}
                />

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
            </View>
            </TouchableWithoutFeedback>
        </Modal>
    </View>);
};

// CSS
const styles = StyleSheet.create({
    container: {flex: 1, padding: 40, marginTop: 40},

    // Text Style
    title: { 
        fontSize: 24, 
        fontWeight: "bold", 
        marginBottom: 20, 
        color: "white", 
        textAlign: "center"},
    input: {
        borderWidth: 3,
        borderColor: "#ccc",
        padding: 10,
        marginBottom: 10,
        borderRadius: 10,
        fontSize: 18,
        color: "white"},

    // Button Style
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

    // Task Style
    task: {
        flexDirection: "row",
        justifyContent: "space-between",
        alignItems: "center",
        marginBottom: 15},
    itemList: {fontSize: 19, color: "white"},

    // Modal Style
    modalBackdrop: {
        flex: 1,
        backgroundColor: "rgba(0,0,0,0.6)",
        justifyContent: "center",
        padding: 24},
    modalCard: {
        backgroundColor: "#181818",
        borderRadius: 16,
        padding: 20},
    modalTitle: {color: "white", fontSize: 20, fontWeight: "bold", marginBottom: 12},
    modalButtons: {flexDirection: "row", justifyContent: "flex-end", alignItems: "center"},
    btn: {paddingVertical: 10, paddingHorizontal: 16, borderRadius: 8},
    btnCancel: {backgroundColor: "#333"},
    btnSave: {backgroundColor: "blue"},
    btnText: {color: "white", fontWeight: "600"}
});

export default App;
