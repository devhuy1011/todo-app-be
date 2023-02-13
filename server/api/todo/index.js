import TodoServices from './services'
import express from 'express'
import { validator} from '../../middlewares'
import { getOneTodoSchema, createTodoSchema, updateTodoSchema} from './validator'

const getOneTodoHandler = async (req, res) => {
  const data = req.query;
  const response = await TodoServices.getOneTodo(data.id);
  return res.status(response.code).send(response.data)
}

const findAllTodoHandler = async (req, res) => {
  const data = req.query;
  const response = await TodoServices.listTodo(data);
  return res.status(response.code).send(response.data)
}

const createTodoHandler = async (req, res) => {
  const data = req.body;
  const response = await TodoServices.createTodo(data);
  return res.status(response.code).send(response.data)
}

const updateTodoHandler = async (req, res) => {
  const data = req.body;
  const response = await TodoServices.updateTodo(data);
  return res.status(response.code).send(response.data)
}

const deleteTodoHandler = async (req, res) => {
  const data = req.query;
  const response = await TodoServices.deleteTodo(data.id);
  return res.status(response.code).send(response.data)
}


const router = express.Router()

router.get('/details', validator(getOneTodoSchema), getOneTodoHandler)
router.get('/list', findAllTodoHandler)
router.post('/create', validator(createTodoSchema), createTodoHandler)
router.put('/update', validator(updateTodoSchema), updateTodoHandler)
router.delete('/delete', deleteTodoHandler)


export default router
