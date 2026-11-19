export class AuthError extends Error{
  constructor(code,message,status){
    super(message);
    this.code=code;
    this.status=status;
  }
}
