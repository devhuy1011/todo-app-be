import ajvInstance from '../../utils/ajv'
import todo from '../../validate-schemas/todo'

const getOneTodo = {
  type: 'object',
  required: ['id'],
  properties: {
    id: todo.id
  },
  errorMessage: {
    required: {
      id: 'id is required'
    }
  },
  additionalProperties: false
}

const createTodo = {
  type: "object",
  required: ['title'],
  properties: {
    title: todo.title,
    description: todo.description,
  },
  errorMessage: {
      required: {
        title: "title is required",
      },
  },
  additionalProperties: false,
};

const updateTodo = {
  type: "object",
  required: ['id'],
  properties: {
    id: todo.id,
    title: todo.title,
    description: todo.description,
    completed: todo.completed
  },
  errorMessage: {
      required: {
        id: "id is required",
      },
  },
  additionalProperties: false,
};



const getOneTodoSchema = ajvInstance.compile(getOneTodo);
const createTodoSchema = ajvInstance.compile(createTodo);
const updateTodoSchema = ajvInstance.compile(updateTodo);
export {
  getOneTodoSchema,
  createTodoSchema,
  updateTodoSchema,
}
