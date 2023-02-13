import db from '../../config/connectDB';
import response from '../../utils/response';
import LOGGER from '../../utils/logger';
import { snakeToCamel } from '../../utils/objStyleConverter';

class TodoServices {
  static async getOneTodo(id) {
    try {
      const connection = db('todo');
      const todo = await connection.select(["todo.*"])
        .where({ 'todo.id': id }).first();
      if (!todo) {
        return response.ERROR(404, 'Not found', "todo_404");
      }

      return response.SUCCESS('get success', snakeToCamel(todo))
    } catch (error) {
      LOGGER.APP.error(error.stack)
      return response.ERROR(500, error.message, "sv_500")
    }
  }

  static async listTodo(){
    try {
      const connection = db('todo');
      const todo = await connection.select(["todo.*"])
        .clone()
        .where({ })
        .orderBy('create_time', 'desc');

      if (!todo) {
        return response.ERROR(404, 'Not found', "todo_404");
      }
      
      return response.SUCCESS('get success', snakeToCamel(todo))
    } catch (error) {
      LOGGER.APP.error(error.stack)
      return response.ERROR(500, error.message, "sv_500")
    }
  }

  static async updateTodo(dataUpdated){
    try {
      const connection = db('todo');
      let {
        id,
        title,
        description,
        completed
      } = dataUpdated;

      const infoUpdate = { };
  
      const todo = await connection.select(["todo.*"])
        .where({ 'todo.id': id }).first();
      if (!todo) {
        return response.ERROR(404, 'Not found', "todo_404");
      }

      if (title != null) {
        infoUpdate.title = title
      }
      if (description != null) {
        infoUpdate.description = description
      }
      if (completed != null) {
        infoUpdate.completed = completed
      }

      await connection.update(infoUpdate).where({ id });

      return response.SUCCESS('Update to do successfully')
    } catch (error) {
      LOGGER.APP.error(error.stack)
      return response.ERROR(500, error.message, "sv_500")
    }
  }

  static async createTodo(dataCreated){
    try {
      const connection = db('todo');
      let {
        title,
        description,
        completed
      } = dataCreated;

      const dataToBeInserted = {
        title,
        description,
        completed,
      };

      await connection.insert(dataToBeInserted, ['id']);
      return response.SUCCESS('Create todo successful!');
    } catch (error) {
      LOGGER.APP.error(error.stack)
      return response.ERROR(500, error.message, "sv_500")
    }
  }

  static async deleteTodo(id){
    try {
      const connection = db('todo');
      const todo = await connection.select(["todo.*"])
        .where({ 'todo.id': id }).first();
      if (!todo) {
        return response.ERROR(404, 'Not found', "todo_404");
      }
      
      await connection.delete(id);
      return response.SUCCESS('Delete Author successful!');

    } catch (error) {
      LOGGER.APP.error(error.stack)
      return response.ERROR(500, error.message, "sv_500")
    }
  }

}

export default TodoServices
