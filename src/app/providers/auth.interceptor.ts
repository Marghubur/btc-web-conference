import { HttpInterceptorFn } from '@angular/common/http';
import { inject } from '@angular/core';
import { JwtService } from './services/jwt.service';

export const authInterceptor: HttpInterceptorFn = (req, next) => {
  if (req.url.includes("auth"))
    return next (req);

  const jwt = inject(JwtService);
  const token = jwt.getJwtToken();
  const modifiedRequest = req.clone({
    setHeaders: {
      Authorization: `Bearer ${token}`
    }
  });

  return next(modifiedRequest);
};
