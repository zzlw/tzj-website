import { Injectable } from "@nestjs/common";
import { RolesService } from "./roles.service";

@Injectable()
export class AccessService {
  constructor(private readonly roles: RolesService) {}

  getRolesOverview() {
    return this.roles.findAllWithStats();
  }
}
