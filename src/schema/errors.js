

class UserError extends Error {
  constructor(props, ...params){
    super(...params);
    this.type = 'User';
    this.props = props;
  }
}
class ValidationError extends Error {
  constructor(props, ...params){
    super(...params);
    this.type = 'Validation';
    this.props = props;
  }
}

export class AppDoesNotExistError extends UserError {
  message =
    `App ${this.props.appName}:${this.props.appVersion} does not exist.`;
  info = this.message;
}
export class InvalidInstanceNameError extends ValidationError {
  message = 'The instance name is not valid.';
  info = 'The instance name must only contain alphanumeric characters or dashes (-) with a maximum of 30 characters.';
}