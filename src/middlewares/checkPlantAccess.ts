import { Request, Response, NextFunction } from 'express';
import { IUser } from '../types/user.types';
import CustomError from '@utils/customError';

interface IRequest extends Request {
  user?: IUser;
}

export const checkPlantAccess = (getPlantIdFromReq: (req: IRequest) => string) => {
  return (req: IRequest, res: Response, next: NextFunction) => {
    const user = req.user as IUser;

    // Admins have access to all
    if (user.role === 'admin') return next();

    // Supervisors can only access their assigned plant
    const requestedPlantId = getPlantIdFromReq(req);

    if (user.role === 'supervisor' && user.plantId?.toString() === requestedPlantId) {
      return next();
    }

    return next(new CustomError('You do not have access to this plant', 403));
  };
};
