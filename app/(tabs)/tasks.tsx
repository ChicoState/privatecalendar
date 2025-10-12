import React, { useState } from "react";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  FlatList,
  StyleSheet,
} from "react-native";

const App: React.FC = () => {
  const [task, setTask] = useState<string>("");
  const [tasks, setTasks] = useState<string[]>([]);
  const [editIndex, setEditIndex] = useState<number>(-1);

  const handleAddTask = () => {
    if (!task.trim()) return;

    if (editIndex !== -1) {
      const updated = [...tasks];
      updated[editIndex] = task.trim();
      setTasks(updated);
      setEditIndex(-1);
    } else {
      setTasks((prev) => [...prev, task.trim()]);
    }
    setTask("");
  };

  const handleEditTask = (index: number) => {
    setTask(tasks[index]);
    setEditIndex(index);
  };

  const handleDeleteTask = (index: number) => {
    const updated = [...tasks];
    updated.splice(index, 1);
    setTasks(updated);
    // if you delete the item being edited, reset edit mode
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

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Task List</Text>

      <TextInput
        style={styles.input}
        placeholder="Enter task"
        value={task}
        onChangeText={setTask}
        returnKeyType="done"
        onSubmitEditing={handleAddTask}
      />

      <TouchableOpacity style={styles.addButton} onPress={handleAddTask}>
        <Text style={styles.addButtonText}>
          {editIndex !== -1 ? "Update Task" : "Add Task"}
        </Text>
      </TouchableOpacity>

      <FlatList
        data={tasks}
        renderItem={renderItem}
        keyExtractor={(_, index) => index.toString()}
        keyboardShouldPersistTaps="handled"
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, padding: 40, marginTop: 40 },
  title: { fontSize: 24, fontWeight: "bold", marginBottom: 20, color: "white"},
  input: {
    borderWidth: 3,
    borderColor: "#ccc",
    padding: 10,
    marginBottom: 10,
    borderRadius: 10,
    fontSize: 18,
    color: "white"
  },
  addButton: {
    backgroundColor: "blue",
    padding: 10,
    borderRadius: 5,
    marginBottom: 10,
  },
  addButtonText: {
    color: "white",
    fontWeight: "bold",
    textAlign: "center",
    fontSize: 18,
  },
  task: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 15,
  },
  itemList: { fontSize: 19, color: "white"},
  taskButtons: { flexDirection: "row" },
  editButton: { marginRight: 10, color: "green", fontWeight: "bold", fontSize: 18 },
  deleteButton: { color: "red", fontWeight: "bold", fontSize: 18 },
});

export default App;
