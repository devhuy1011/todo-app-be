
const todoModel = (knex) => {
  return knex.schema.hasTable('todo').then(function (exists) {
    if (!exists) {
      return knex.schema.createTable('todo', function (property) {
        property.increments('id').unsigned().primary();
        property.string('title', 255);
        property.text('description');
        property.boolean('completed').defaultTo(0);
        property.datetime('create_time').notNullable().defaultTo(knex.raw('NOW()'));
      })
    }
  })
}

module.exports = {
  todoModel
}
